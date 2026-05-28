import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT_DIR, 'data'));
const SNAPSHOT_DB_PATH = path.resolve(process.env.DATABASE_PATH || path.join(DATA_DIR, 'app.db'));
const ACTIVE_DB_PATH = path.join(os.tmpdir(), 'repositorio-aplicacao.sqlite3');
const VISOES_CSV = path.join(DATA_DIR, 'fluxos_visoes_rows.csv');
const COMPONENTES_CSV = path.join(DATA_DIR, 'catalogo_componentes_rows.csv');
const NODES_CSV = path.join(DATA_DIR, 'fluxo_nos_posicoes_rows.csv');
const CONNECTIONS_CSV = path.join(DATA_DIR, 'fluxo_conexoes_rows.csv');

ensureDataDirectory();
syncDatabaseSnapshotToActive();
const db = new DatabaseSync(ACTIVE_DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
initSchema();
seedDatabase();
persistDatabaseSnapshot();

function ensureDataDirectory() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function syncDatabaseSnapshotToActive() {
  if (existsSync(SNAPSHOT_DB_PATH)) {
    mkdirSync(path.dirname(ACTIVE_DB_PATH), { recursive: true });
    copyFileSync(SNAPSHOT_DB_PATH, ACTIVE_DB_PATH);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function persistDatabaseSnapshot() {
  mkdirSync(path.dirname(SNAPSHOT_DB_PATH), { recursive: true });
  if (existsSync(ACTIVE_DB_PATH)) {
    copyFileSync(ACTIVE_DB_PATH, SNAPSHOT_DB_PATH);
  }
}

function initSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS fluxos_visoes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      criado_em TEXT NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'painel',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalogo_componentes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fluxo_nos_posicoes (
      id TEXT PRIMARY KEY,
      visao_id TEXT NOT NULL REFERENCES fluxos_visoes(id) ON DELETE CASCADE,
      componente_id TEXT NOT NULL REFERENCES catalogo_componentes(id),
      posicao_x REAL NOT NULL DEFAULT 0,
      posicao_y REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS fluxo_conexoes (
      id TEXT PRIMARY KEY,
      visao_id TEXT NOT NULL REFERENCES fluxos_visoes(id) ON DELETE CASCADE,
      origem_no_id TEXT NOT NULL REFERENCES fluxo_nos_posicoes(id) ON DELETE CASCADE,
      destino_no_id TEXT NOT NULL REFERENCES fluxo_nos_posicoes(id) ON DELETE CASCADE,
      source_handle TEXT,
      target_handle TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_fluxo_nos_visao_id ON fluxo_nos_posicoes(visao_id);
    CREATE INDEX IF NOT EXISTS idx_fluxo_conexoes_visao_id ON fluxo_conexoes(visao_id);
    CREATE INDEX IF NOT EXISTS idx_fluxo_conexoes_origem_no_id ON fluxo_conexoes(origem_no_id);
    CREATE INDEX IF NOT EXISTS idx_fluxo_conexoes_destino_no_id ON fluxo_conexoes(destino_no_id);
  `);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function readCsvRows(filePath) {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);

  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function csvText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function csvNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function run(sql, params = []) {
  return db.prepare(sql).run(...params);
}

function get(sql, params = []) {
  return db.prepare(sql).get(...params) ?? null;
}

function all(sql, params = []) {
  return db.prepare(sql).all(...params);
}

function seedDatabase() {
  if (get('SELECT COUNT(*) AS count FROM fluxos_visoes')?.count === 0) {
    const rows = readCsvRows(VISOES_CSV);
    if (rows.length > 0) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const stmt = db.prepare(`
          INSERT INTO fluxos_visoes (id, nome, descricao, criado_em, categoria, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const row of rows) {
          stmt.run(
            csvText(row.id),
            csvText(row.nome),
            row.descricao ? String(row.descricao) : null,
            csvText(row.criado_em, nowIso()),
            csvText(row.categoria, 'painel'),
            csvText(row.updated_at, nowIso())
          );
        }

        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  }

  if (get('SELECT COUNT(*) AS count FROM catalogo_componentes')?.count === 0) {
    const rows = readCsvRows(COMPONENTES_CSV);
    if (rows.length > 0) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const stmt = db.prepare(`
          INSERT INTO catalogo_componentes (id, nome, tipo, criado_em)
          VALUES (?, ?, ?, ?)
        `);

        for (const row of rows) {
          stmt.run(
            csvText(row.id),
            csvText(row.nome),
            csvText(row.tipo),
            csvText(row.criado_em, nowIso())
          );
        }

        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  }

  if (get('SELECT COUNT(*) AS count FROM fluxo_nos_posicoes')?.count === 0) {
    const rows = readCsvRows(NODES_CSV);
    if (rows.length > 0) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const stmt = db.prepare(`
          INSERT INTO fluxo_nos_posicoes (id, visao_id, componente_id, posicao_x, posicao_y)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const row of rows) {
          stmt.run(
            csvText(row.id),
            csvText(row.visao_id),
            csvText(row.componente_id),
            csvNumber(row.posicao_x, 0),
            csvNumber(row.posicao_y, 0)
          );
        }

        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  }

  if (get('SELECT COUNT(*) AS count FROM fluxo_conexoes')?.count === 0) {
    const rows = readCsvRows(CONNECTIONS_CSV);
    if (rows.length > 0) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const stmt = db.prepare(`
          INSERT INTO fluxo_conexoes (id, visao_id, origem_no_id, destino_no_id, source_handle, target_handle)
          VALUES (?, ?, ?, ?, NULL, NULL)
        `);

        for (const row of rows) {
          stmt.run(
            csvText(row.id),
            csvText(row.visao_id),
            csvText(row.origem_no_id),
            csvText(row.destino_no_id)
          );
        }

        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  }
}

function getOppositeSide(side) {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    default:
      return 'right';
  }
}

function getHandleSide(from, to) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function normalizePoint(node) {
  if (!node) return null;

  if (node.position && typeof node.position.x === 'number' && typeof node.position.y === 'number') {
    return node.position;
  }

  if (typeof node.posicao_x === 'number' && typeof node.posicao_y === 'number') {
    return { x: node.posicao_x, y: node.posicao_y };
  }

  if (typeof node.x === 'number' && typeof node.y === 'number') {
    return { x: node.x, y: node.y };
  }

  return null;
}

function resolveConnectionHandles(sourceNode, targetNode, connection) {
  const sourcePoint = normalizePoint(sourceNode);
  const targetPoint = normalizePoint(targetNode);

  if (!sourcePoint || !targetPoint) {
    return {
      sourceHandle: connection?.sourceHandle || connection?.source_handle || 'right',
      targetHandle: connection?.targetHandle || connection?.target_handle || 'left'
    };
  }

  const sourceHandle =
    connection?.sourceHandle || connection?.source_handle || getHandleSide(sourcePoint, targetPoint);
  const targetHandle =
    connection?.targetHandle || connection?.target_handle || getOppositeSide(sourceHandle);

  return { sourceHandle, targetHandle };
}

function getEdgeColorByType(tipo) {
  switch (tipo) {
    case 'painel':
      return '#22c55e';
    case 'tabela':
      return '#3b82f6';
    case 'componente_web':
      return '#ec4899';
    case 'service':
      return '#ef4444';
    default:
      return '#22c55e';
  }
}

function normalizeVisaoCategoria(categoria) {
  if (categoria === 'painel' || categoria === 'modulo' || categoria === 'bi') {
    return categoria;
  }

  return 'painel';
}

function touchVisaoUpdatedAt(visaoId) {
  run(`UPDATE fluxos_visoes SET updated_at = ? WHERE id = ?`, [nowIso(), visaoId]);
}

function deleteFlowCascade(visaoId) {
  run(`DELETE FROM fluxos_visoes WHERE id = ?`, [visaoId]);
}

function fetchFlowNodes(visaoId) {
  return all(
    `
      SELECT
        n.id,
        n.posicao_x,
        n.posicao_y,
        c.nome AS nome,
        c.tipo AS tipo
      FROM fluxo_nos_posicoes n
      INNER JOIN catalogo_componentes c ON c.id = n.componente_id
      WHERE n.visao_id = ?
    `,
    [visaoId]
  );
}

function fetchFlowConnections(visaoId) {
  return all(
    `
      SELECT
        id,
        origem_no_id,
        destino_no_id,
        source_handle,
        target_handle
      FROM fluxo_conexoes
      WHERE visao_id = ?
    `,
    [visaoId]
  );
}

function getNodeById(nodeId) {
  return get(
    `
      SELECT
        n.id,
        n.visao_id,
        n.componente_id,
        n.posicao_x,
        n.posicao_y,
        c.nome,
        c.tipo
      FROM fluxo_nos_posicoes n
      INNER JOIN catalogo_componentes c ON c.id = n.componente_id
      WHERE n.id = ?
    `,
    [nodeId]
  );
}

function upsertComponent({ nome, tipo }) {
  const normalizedName = String(nome ?? '').trim();
  const normalizedType = String(tipo ?? '').trim();
  const componentId = crypto.randomUUID();
  const timestamp = nowIso();

  run(
    `
      INSERT INTO catalogo_componentes (id, nome, tipo, criado_em)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(nome) DO UPDATE SET
        tipo = excluded.tipo
    `,
    [componentId, normalizedName, normalizedType, timestamp]
  );

  return get(`SELECT id, nome, tipo, criado_em FROM catalogo_componentes WHERE nome = ?`, [normalizedName]);
}

app.get('/api/fluxo/:visaoId', (req, res) => {
  try {
    const { visaoId } = req.params;
    const nodes = fetchFlowNodes(visaoId);
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const conexoes = fetchFlowConnections(visaoId);

    const formattedNodes = nodes.map((node) => ({
      id: node.id,
      type: node.tipo,
      position: { x: node.posicao_x, y: node.posicao_y },
      data: { label: node.nome }
    }));

    const formattedEdges = conexoes.map((edge) => {
      const sourceNode = nodeMap.get(edge.origem_no_id);
      const targetNode = nodeMap.get(edge.destino_no_id);
      const sourceType = sourceNode?.tipo ?? null;
      const sourceColor = getEdgeColorByType(sourceType);
      const handles = resolveConnectionHandles(sourceNode, targetNode, edge);

      return {
        id: edge.id,
        source: edge.origem_no_id,
        target: edge.destino_no_id,
        ...handles,
        animated: true,
        sourceType,
        sourceColor,
        style: { stroke: sourceColor }
      };
    });

    res.json({ nodes: formattedNodes, edges: formattedEdges });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/visoes', (_req, res) => {
  try {
    const data = all(`SELECT * FROM fluxos_visoes ORDER BY updated_at DESC, nome ASC`);
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/visoes', (req, res) => {
  try {
    const { nome, categoria } = req.body;
    const cleanNome = String(nome ?? '').trim();
    if (!cleanNome) {
      return res.status(400).json({ error: 'Nome obrigatorio' });
    }

    const id = crypto.randomUUID();
    const timestamp = nowIso();
    const row = {
      id,
      nome: cleanNome,
      descricao: null,
      criado_em: timestamp,
      categoria: normalizeVisaoCategoria(categoria),
      updated_at: timestamp
    };

    run(
      `
        INSERT INTO fluxos_visoes (id, nome, descricao, criado_em, categoria, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [row.id, row.nome, row.descricao, row.criado_em, row.categoria, row.updated_at]
    );

    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/visoes/:id', (req, res) => {
  try {
    const { nome, categoria } = req.body;
    const cleanNome = String(nome ?? '').trim();
    if (!cleanNome) {
      return res.status(400).json({ error: 'Nome obrigatorio' });
    }

    const updatedAt = nowIso();
    const result = run(
      `
        UPDATE fluxos_visoes
        SET nome = ?, categoria = ?, updated_at = ?
        WHERE id = ?
      `,
      [cleanNome, normalizeVisaoCategoria(categoria), updatedAt, req.params.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Visao nao encontrada' });
    }

    const row = get(`SELECT * FROM fluxos_visoes WHERE id = ?`, [req.params.id]);
    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/visoes/:id', (req, res) => {
  try {
    deleteFlowCascade(req.params.id);
    res.sendStatus(204);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/fluxo/no', (req, res) => {
  try {
    const { visaoId, nome, tipo } = req.body;
    const cleanNome = String(nome ?? '').trim();
    const cleanTipo = String(tipo ?? '').trim();

    if (!visaoId || !cleanNome || !cleanTipo) {
      return res.status(400).json({ error: 'Dados obrigatorios ausentes' });
    }

    const component = upsertComponent({ nome: cleanNome, tipo: cleanTipo });
    if (!component) {
      return res.status(400).json({ error: 'Nao foi possivel criar o componente' });
    }

    const nodeId = crypto.randomUUID();
    run(
      `
        INSERT INTO fluxo_nos_posicoes (id, visao_id, componente_id, posicao_x, posicao_y)
        VALUES (?, ?, ?, 0, 0)
      `,
      [nodeId, visaoId, component.id]
    );

    touchVisaoUpdatedAt(visaoId);

    res.status(201).json({
      id: nodeId,
      type: component.tipo,
      position: { x: 0, y: 0 },
      data: { label: component.nome }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fluxo/conexao', (req, res) => {
  try {
    const { visaoId, source, target } = req.body;
    if (!visaoId || !source || !target) {
      return res.status(400).json({ error: 'Dados obrigatorios ausentes' });
    }

    const nodes = all(
      `
        SELECT
          n.id,
          n.posicao_x,
          n.posicao_y,
          c.tipo
        FROM fluxo_nos_posicoes n
        INNER JOIN catalogo_componentes c ON c.id = n.componente_id
        WHERE n.visao_id = ? AND n.id IN (?, ?)
      `,
      [visaoId, source, target]
    );

    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);

    if (!sourceNode || !targetNode) {
      return res.status(400).json({ error: 'Nos nao encontrados' });
    }

    const resolvedHandles = resolveConnectionHandles(sourceNode, targetNode);
    const connectionId = crypto.randomUUID();

    run(
      `
        INSERT INTO fluxo_conexoes (id, visao_id, origem_no_id, destino_no_id, source_handle, target_handle)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [connectionId, visaoId, source, target, resolvedHandles.sourceHandle, resolvedHandles.targetHandle]
    );

    const sourceType = sourceNode.tipo;
    const sourceColor = getEdgeColorByType(sourceType);
    touchVisaoUpdatedAt(visaoId);

    res.status(201).json({
      id: connectionId,
      visao_id: visaoId,
      origem_no_id: source,
      destino_no_id: target,
      sourceHandle: resolvedHandles.sourceHandle,
      targetHandle: resolvedHandles.targetHandle,
      sourceType,
      sourceColor,
      style: { stroke: sourceColor }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/fluxo/conexao/:id', (req, res) => {
  try {
    const conexao = get(`SELECT visao_id FROM fluxo_conexoes WHERE id = ?`, [req.params.id]);
    const result = run(`DELETE FROM fluxo_conexoes WHERE id = ?`, [req.params.id]);
    if (result.changes === 0) {
      return res.sendStatus(204);
    }

    if (conexao?.visao_id) {
      touchVisaoUpdatedAt(conexao.visao_id);
    }

    res.sendStatus(204);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/fluxo/no/posicao', (req, res) => {
  try {
    const { noId, posicao_x, posicao_y } = req.body;
    const result = run(
      `
        UPDATE fluxo_nos_posicoes
        SET posicao_x = ?, posicao_y = ?
        WHERE id = ?
      `,
      [Number(posicao_x) || 0, Number(posicao_y) || 0, noId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'No nao encontrado' });
    }

    const node = get(`SELECT visao_id FROM fluxo_nos_posicoes WHERE id = ?`, [noId]);
    if (node?.visao_id) {
      touchVisaoUpdatedAt(node.visao_id);
    }

    res.sendStatus(204);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/fluxo/no/nome', (req, res) => {
  try {
    const { noId, nome } = req.body;
    const cleanNome = String(nome ?? '').trim();
    if (!cleanNome) {
      return res.status(400).json({ error: 'Nome obrigatorio' });
    }

    const node = get(`SELECT componente_id, visao_id FROM fluxo_nos_posicoes WHERE id = ?`, [noId]);
    if (!node) {
      return res.status(404).json({ error: 'Nó não encontrado' });
    }

    const result = run(`UPDATE catalogo_componentes SET nome = ? WHERE id = ?`, [cleanNome, node.componente_id]);
    if (result.changes === 0) {
      return res.status(400).json({ error: 'Nao foi possivel atualizar o nome' });
    }

    touchVisaoUpdatedAt(node.visao_id);
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/fluxo/no/:id', (req, res) => {
  try {
    const node = get(`SELECT visao_id FROM fluxo_nos_posicoes WHERE id = ?`, [req.params.id]);
    const result = run(`DELETE FROM fluxo_nos_posicoes WHERE id = ?`, [req.params.id]);

    if (result.changes === 0) {
      return res.sendStatus(204);
    }

    if (node?.visao_id) {
      touchVisaoUpdatedAt(node.visao_id);
    }

    res.sendStatus(204);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;

function isDirectExecution() {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;

  return import.meta.url === pathToFileURL(entryPoint).href;
}

if (isDirectExecution()) {
  app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));
}

export default app;
