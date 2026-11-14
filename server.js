import 'dotenv/config';

import express from 'express';
import { respostas } from './loja.js';
import pino from 'pino';
import QRCode from 'qrcode';
import { timingSafeEqual } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(resolve('public')));

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const PORT = Number(process.env.PORT || 3000);
const SESSION_DIR = resolve(process.env.SESSION_DIR || './auth');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const AUTO_CONNECT = process.env.AUTO_CONNECT === 'true';
const BOT_PHONE = process.env.BOT_PHONE || '';


if (ADMIN_TOKEN.length < 24) {
  console.error('Configure ADMIN_TOKEN com pelo menos 24 caracteres no .env.');
  process.exit(1);
}

let socket = null;
let authState = null;
let status = 'offline';
let pairingCode = null;
let latestQr = null;
let lastConnectionError = null;
let pairingInProgress = false;
let pairingTimer = null;
let socketReady = false;
let startPromise = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let shuttingDown = false;
let manuallyDisconnected = false;
let connectionGeneration = 0;

const readyWaiters = new Set();

function safeTokenEqual(candidate) {
  if (typeof candidate !== 'string') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authenticate(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  if (!safeTokenEqual(req.get('x-admin-token'))) {
    return res.status(401).json({ error: 'Acesso não autorizado. Verifique o token.' });
  }
  next();
}

function settleReadyWaiters(error) {
  for (const waiter of readyWaiters) {
    clearTimeout(waiter.timer);
    if (error) waiter.reject(error);
    else waiter.resolve();
  }
  readyWaiters.clear();
}

function waitForSocketReady(sock, timeoutMs = 45000) {
  if (socket !== sock) return Promise.reject(new Error('A conexão foi reiniciada.'));
  if (socketReady) return Promise.resolve();

  return new Promise((resolvePromise, rejectPromise) => {
    const waiter = {
      resolve: resolvePromise,
      reject: rejectPromise,
      timer: setTimeout(() => {
        readyWaiters.delete(waiter);
        rejectPromise(new Error('O WhatsApp não ficou pronto a tempo. Tente novamente.'));
      }, timeoutMs)
    };
    readyWaiters.add(waiter);
  });
}

function clearPairingLock() {
  if (pairingTimer) clearTimeout(pairingTimer);
  pairingTimer = null;
  pairingInProgress = false;
  pairingCode = null;
}

function scheduleReconnect() {
  if (shuttingDown || manuallyDisconnected || reconnectTimer || status === 'logged_out') return;

  const delay = Math.min(3000 * (2 ** reconnectAttempts), 60000);
  reconnectAttempts += 1;
  log.info({ delay, attempt: reconnectAttempts }, 'Reconexão agendada');

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startSocket().catch(error => log.error({ err: error }, 'Falha na reconexão'));
  }, delay);
}

async function startSocket() {
  if (shuttingDown) throw new Error('O servidor está a encerrar.');
  if (startPromise) return startPromise;
  if (socket) return socket;

  startPromise = (async () => {
    status = 'connecting';
    socketReady = false;
    latestQr = null;
    lastConnectionError = null;

    await mkdir(SESSION_DIR, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    authState = state;

    const { version, isLatest } = await fetchLatestBaileysVersion();
    log.info({ version, isLatest }, 'Versão do WhatsApp Web selecionada');

    const generation = ++connectionGeneration;
    const sock = makeWASocket({
      version,
      auth: state,
      logger: log.child({ component: 'baileys' }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false
    });

    socket = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
      if (generation !== connectionGeneration || socket !== sock) return;
      if (qr) {
        latestQr = qr;
        socketReady = true;
        if (!state.creds.registered) status = 'pairing_ready';
        settleReadyWaiters();
      }

      if (connection === 'open') {
        settleReadyWaiters();
        status = 'connected';
        latestQr = null;
        lastConnectionError = null;
        socketReady = false;
        reconnectAttempts = 0;
        clearPairingLock();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = null;
        log.info('ZUMY BOT conectado ao WhatsApp.');
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
          ?? lastDisconnect?.error?.statusCode;

        lastConnectionError = `Conexão encerrada (código ${code ?? 'desconhecido'}). Consulte os logs da Railway.`;
        latestQr = null;
        log.warn({ disconnectCode: code }, 'Conexão WhatsApp encerrada');
        if (socket === sock) { socket = null; connectionGeneration++; }
        socketReady = false;
        settleReadyWaiters(new Error('A conexão foi encerrada antes de concluir o pareamento.'));
        clearPairingLock();

        if (code === DisconnectReason.loggedOut) {
          status = 'logged_out';
          lastConnectionError = 'WhatsApp desvinculou esta sessão (401). Revise Dispositivos conectados e faça novo pareamento; se necessário, remova a sessão antiga da hospedagem.';
          log.error('Sessão terminada. Será necessário emparelhar novamente.');
          return;
        }

        if (manuallyDisconnected) {
          status = 'offline';
          return;
        }
        if (code === 515) lastConnectionError = 'WhatsApp solicitou reinicialização da conexão (515). Reconectando automaticamente.';
        if (code === 440) lastConnectionError = 'Conflito de sessão (440). Verifique se outro servidor está usando a mesma sessão.';
        status = 'reconnecting';
        if (!shuttingDown) scheduleReconnect();
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages || []) {
        try {
          if (!msg?.message || msg.key?.fromMe) continue;
          const jid = msg.key?.remoteJid;
          if (!jid || !/@(s.whatsapp.net|lid)$/.test(jid)) continue;

          let content = msg.message;
          content = content.ephemeralMessage?.message
            || content.viewOnceMessage?.message
            || content.viewOnceMessageV2?.message
            || content;

          const text = content.conversation
            || content.extendedTextMessage?.text
            || content.imageMessage?.caption
            || content.videoMessage?.caption
            || '';

          for (const payload of respostas(text, Boolean(content.imageMessage || content.documentMessage))) {
            if (socket !== sock) break;
            await sock.sendMessage(jid, payload, { quoted: msg });
          }
        } catch (error) {
          log.error({ err: error }, 'Erro ao processar mensagem');
        }
      }
    });

    return sock;
  })();

  try {
    return await startPromise;
  } catch (error) {
    socket = null;
    socketReady = false;
    status = 'error';
    settleReadyWaiters(error);
    log.error({ err: error }, 'Erro ao iniciar socket WhatsApp');
    scheduleReconnect();
    throw error;
  } finally {
    startPromise = null;
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, status });
});

app.get('/api/status', authenticate, (_req, res) => {
  res.json({
    status,
    connected: status === 'connected',
    registered: Boolean(authState?.creds?.registered),
    pairing: pairingInProgress,
    pairingCode: pairingInProgress ? pairingCode : null,
    botPhone: BOT_PHONE,

    qrAvailable: Boolean(latestQr),
    lastConnectionError
  });
});

app.post('/api/connect-qr', authenticate, async (_req, res) => {
  manuallyDisconnected = false;
  try {
    await startSocket();
    if (status === 'connected') return res.json({ status: 'connected' });
    if (authState?.creds?.registered) return res.status(409).json({ error: 'Sessão já registrada. Aguarde reconexão ou desvincule a sessão antiga antes de parear.' });
    return res.json({ status, message: 'Aguarde o QR Code aparecer no painel.' });
  } catch (error) {
    log.error({ err: error }, 'Falha ao iniciar QR');
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/qr', authenticate, async (_req, res) => {
  if (!latestQr || authState?.creds?.registered) return res.status(404).json({ error: 'QR Code indisponível. Clique em Conectar por QR Code e aguarde.' });
  try {
    return res.json({ image: await QRCode.toDataURL(latestQr, { margin: 2, width: 320 }) });
  } catch (error) { return res.status(500).json({ error: 'Falha ao renderizar QR Code.' }); }
});

app.post('/api/connect', authenticate, async (req, res) => {
  const phone = String(req.body?.phone || BOT_PHONE).replace(/\D/g, '');
  if (BOT_PHONE && phone !== BOT_PHONE) return res.status(400).json({ error: 'Use o número cadastrado para esta instalação.' });

  if (!/^[1-9]\d{7,14}$/.test(phone)) {
    return res.status(400).json({ error: 'Informe o número com DDI, apenas dígitos (8 a 15 números).' });
  }
  if (status === 'connected') return res.json({ status: 'connected' });
  if (pairingInProgress) {
    return res.status(409).json({ error: 'Já existe um código de pareamento ativo. Use esse código ou aguarde a expiração.' });
  }

  manuallyDisconnected = false;
  pairingInProgress = true;
  pairingCode = null;

  try {
    const sock = await startSocket();

    if (authState?.creds?.registered) {
      pairingInProgress = false;
      return res.status(409).json({ error: 'Já existe uma sessão registada. Aguarde a conexão automática.' });
    }

    await waitForSocketReady(sock);
    if (socket !== sock) throw new Error('O socket foi reiniciado. Solicite um novo código.');

    // Aguardar a inicialização do transporte antes de solicitar pareamento.
    const code = await Promise.race([
      sock.requestPairingCode(phone),
      new Promise((_, reject) => setTimeout(() => reject(new Error('O WhatsApp não respondeu ao pedido do código em 25 segundos. Tente QR Code ou consulte os logs.')), 25000))
    ]);
    if (socket !== sock) throw new Error('A conexão mudou durante a solicitação do código.');

    pairingCode = code;
    status = 'pairing';
    pairingTimer = setTimeout(() => {
      clearPairingLock();
      if (status === 'pairing') status = 'pairing_ready';
      log.info('Código de pareamento expirou; um novo pedido poderá ser feito.');
    }, 90000);

    log.info('Código de pareamento gerado.');
    return res.json({ status, code });
  } catch (error) {
    clearPairingLock();
    lastConnectionError = error?.message || 'Falha ao gerar código';
    log.error({ err: error }, 'Falha ao gerar código de pareamento');
    return res.status(500).json({ error: error?.message || 'Não foi possível gerar o código.' });
  }
});

app.post('/api/disconnect', authenticate, async (_req, res) => {
  manuallyDisconnected = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  clearPairingLock();
  latestQr = null;

  if (socket) {
    const current = socket;
    socket = null;
    connectionGeneration++;
    socketReady = false;
    try { current.end(new Error('Desconexão solicitada pelo administrador.')); } catch {}
  }

  status = 'offline';
  res.json({ status });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  log.info({ port: PORT }, 'ZUMY BOT server iniciado');
});

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, 'Encerrando ZUMY BOT');
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pairingTimer) clearTimeout(pairingTimer);
  settleReadyWaiters(new Error('Servidor encerrado.'));
  server.close();

  if (socket) {
    try { socket.end(new Error('Servidor encerrado.')); } catch {}
    socket = null;
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

if (AUTO_CONNECT) {
  startSocket().catch(error => log.error({ err: error }, 'Conexão automática falhou'));
}
