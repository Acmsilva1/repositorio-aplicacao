import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  ConnectionMode,
  Edge,
  Handle,
  Node,
  NodeDragHandler,
  NodeProps,
  Position,
  MarkerType,
  useReactFlow,
  useEdgesState,
  useNodesState
} from 'reactflow';
import axios from 'axios';
import 'reactflow/dist/style.css';

const API_URL =
  (import.meta as any).env.VITE_API_URL || ((import.meta as any).env.DEV ? 'http://localhost:3001/api' : '/api');

const nodeOptions = [
  { type: 'painel', label: 'Painel', emoji: '📊', className: 'painel-node', accent: '#38bdf8' },
  { type: 'componente_web', label: 'Componente Web', emoji: '💻', className: 'web-node', accent: '#10b981' },
  { type: 'service', label: 'Service / API', emoji: '⚙️', className: 'service-node', accent: '#f97316' },
  { type: 'tabela', label: 'Tabela / View', emoji: '🛢️', className: 'tabela-node', accent: '#c084fc' }
] as const;

type FlowType = (typeof nodeOptions)[number]['type'];
type FlowMode = 'hall' | 'canvas';
type VisaoItem = { id: string; nome: string };
type FlowNodeData = { label: string };
type FlowNode = Node<FlowNodeData, FlowType>;

const edgeColorByType: Record<FlowType, string> = {
  painel: '#22c55e',
  tabela: '#3b82f6',
  componente_web: '#ec4899',
  service: '#ef4444'
};

const nodeOptionByType = nodeOptions.reduce<Record<FlowType, (typeof nodeOptions)[number]>>(
  (acc, option) => {
    acc[option.type] = option;
    return acc;
  },
  {} as Record<FlowType, (typeof nodeOptions)[number]>
);

type HallPalette = {
  accent: string;
  accent2: string;
  accent3: string;
};

const hallPalettes: HallPalette[] = [
  { accent: '#38bdf8', accent2: '#22c55e', accent3: '#0ea5e9' },
  { accent: '#f97316', accent2: '#fb7185', accent3: '#f59e0b' },
  { accent: '#22c55e', accent2: '#14b8a6', accent3: '#84cc16' },
  { accent: '#c084fc', accent2: '#8b5cf6', accent3: '#ec4899' },
  { accent: '#06b6d4', accent2: '#3b82f6', accent3: '#67e8f9' },
  { accent: '#f43f5e', accent2: '#fb7185', accent3: '#f59e0b' }
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getHallPalette(seed: string): HallPalette {
  return hallPalettes[hashString(seed) % hallPalettes.length];
}

function getEdgeColor(type?: string | null) {
  if (!type) return '#22c55e';
  return edgeColorByType[type as FlowType] ?? '#22c55e';
}

const handleSides = ['top', 'right', 'bottom', 'left'] as const;
type HandleSide = (typeof handleSides)[number];

function getOppositeSide(side: HandleSide): HandleSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'right':
      return 'left';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
  }
}

function getHandleSide(from: { x: number; y: number }, to: { x: number; y: number }): HandleSide {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function resolveEdgeHandles(
  sourceNode: { position: { x: number; y: number } },
  targetNode: { position: { x: number; y: number } },
  params?: Connection
) {
  const sourceSide = (params?.sourceHandle as HandleSide | undefined) ?? getHandleSide(sourceNode.position, targetNode.position);
  const targetSide = (params?.targetHandle as HandleSide | undefined) ?? getOppositeSide(sourceSide);

  return {
    sourceHandle: sourceSide,
    targetHandle: targetSide
  };
}

const nodeTypes = {
  painel: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />,
  componente_web: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />,
  service: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />,
  tabela: (props: NodeProps<FlowNodeData>) => <CanvasNode {...props} />
};

function applyEdgeColor(edge: Edge & { sourceColor?: string | null }, sourceType?: string | null) {
  const stroke = edge.sourceColor || getEdgeColor(sourceType);
  return {
    ...edge,
    style: { ...(edge.style ?? {}), stroke },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: stroke
    }
  };
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 16.5V20h3.5L18 9.5l-3.5-3.5L4 16.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13 6l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7h16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 7l.7 11.2A1.8 1.8 0 0 0 9 20h6a1.8 1.8 0 0 0 1.8-1.8L17.5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 10v6M14 10v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.5 8.5h5l2 2H20.5a1 1 0 0 1 1 1V18a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 8.5V6.75A1.75 1.75 0 0 1 5.25 5h4.1c.46 0 .9.18 1.23.51L12 7h7.25A1.75 1.75 0 0 1 21 8.75V10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CanvasZoomControls() {
  const { zoomIn, zoomOut } = useReactFlow();

  return (
    <div className="canvas-zoom-controls" aria-label="Controles de zoom">
      <button type="button" className="canvas-zoom-button" onClick={() => zoomIn()}>
        +
      </button>
      <button type="button" className="canvas-zoom-button" onClick={() => zoomOut()}>
        -
      </button>
    </div>
  );
}

function CanvasNode({ data, type }: NodeProps<FlowNodeData>) {
  const option = nodeOptionByType[(type as FlowType) ?? 'tabela'];
  const handleStyle = { background: 'var(--node-accent)', width: 10, height: 10, border: 'none' };
  const nodeStyle = { '--node-accent': option.accent } as CSSProperties;

  return (
    <div className={`custom-node ${option.className}`} style={nodeStyle}>
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        style={{ ...handleStyle, top: -5 }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ ...handleStyle, right: -5 }}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={{ ...handleStyle, bottom: -5 }}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        style={{ ...handleStyle, left: -5 }}
      />
      <div className="node-emoji">{option.emoji}</div>
      <div className="node-label">{data.label}</div>
    </div>
  );
}

function HallModal({
  open,
  title,
  description,
  initialValue,
  submitLabel,
  onClose,
  onSubmit
}: {
  open: boolean;
  title: string;
  description: string;
  initialValue: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;

    setSaving(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Nome
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ex: Painel x"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

function NodeModal({
  open,
  initialType,
  onClose,
  onSubmit
}: {
  open: boolean;
  initialType: FlowType;
  onClose: () => void;
  onSubmit: (payload: { nome: string; tipo: FlowType }) => Promise<void>;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<FlowType>(initialType);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome('');
      setTipo(initialType);
    }
  }, [open, initialType]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = nome.trim();
    if (!value) return;

    setSaving(true);
    try {
      await onSubmit({ nome: value, tipo });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-wide" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Novo item no canvas</h3>
            <p>Escolha o tipo pelo ícone e informe o nome do item.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Nome
            <input
              autoFocus
              type="text"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex: cmc_hospital.tbl_exemplo"
            />
          </label>

          <div className="type-grid">
            {nodeOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                className={`type-card ${tipo === option.type ? 'active' : ''}`}
                onClick={() => setTipo(option.type)}
              >
                <span className="type-card-emoji">{option.emoji}</span>
                <span className="type-card-label">{option.label}</span>
              </button>
            ))}
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar item'}
          </button>
        </form>
      </div>
    </div>
  );
}

function NodeRenameModal({
  open,
  title,
  initialValue,
  onClose,
  onSubmit
}: {
  open: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = draft.trim();
    if (!value) return;

    setSaving(true);
    try {
      await onSubmit(value);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-rename" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p>Atualize o nome do item selecionado no canvas.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Nome
            <input
              autoFocus
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ex: Status das Unidades"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar nome'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card-delete" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="delete-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary danger" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Excluindo...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function HallCard({
  visao,
  onOpen,
  onEdit,
  onDelete,
  palette,
  featured = false
}: {
  visao: VisaoItem;
  onOpen: (visao: VisaoItem) => void;
  onEdit: (visao: VisaoItem) => void;
  onDelete: (visao: VisaoItem) => void;
  palette: HallPalette;
  featured?: boolean;
}) {
  return (
    <article
      className={`hall-card ${featured ? 'featured' : ''}`}
      style={
        {
          '--card-accent': palette.accent,
          '--card-accent-2': palette.accent2,
          '--card-accent-3': palette.accent3
        } as CSSProperties
      }
    >
      <button className="hall-card-main" type="button" onClick={() => onOpen(visao)}>
        <div className="hall-card-orb">
          <div className="hall-card-badge">
            <FolderIcon />
          </div>
          <div className="hall-card-copy">
            <strong>{visao.nome}</strong>
          </div>
        </div>
      </button>

      <div className="hall-card-actions">
        <button
          type="button"
          className="hall-icon-button"
          onClick={() => onEdit(visao)}
          aria-label={`Editar ${visao.nome}`}
          title={`Editar ${visao.nome}`}
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          className="hall-icon-button danger"
          onClick={() => onDelete(visao)}
          aria-label={`Excluir ${visao.nome}`}
          title={`Excluir ${visao.nome}`}
        >
          <TrashIcon />
        </button>
      </div>
    </article>
  );
}

export default function App() {
  const [mode, setMode] = useState<FlowMode>('hall');
  const [visoes, setVisoes] = useState<VisaoItem[]>([]);
  const [currentVisao, setCurrentVisao] = useState<VisaoItem | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [isHallModalOpen, setIsHallModalOpen] = useState(false);
  const [hallModalMode, setHallModalMode] = useState<'create' | 'edit'>('create');
  const [editingVisao, setEditingVisao] = useState<VisaoItem | null>(null);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VisaoItem | null>(null);
  const [renamingNodeId, setRenamingNodeId] = useState('');
  const [renamingNodeName, setRenamingNodeName] = useState('');
  const [nodeModalType, setNodeModalType] = useState<FlowType>('tabela');
  const [canvasMode, setCanvasMode] = useState<'view' | 'edit'>('view');
  const [hallSearch, setHallSearch] = useState('');
  const selectedNodeType = useMemo(() => {
    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    return (selectedNode?.type as FlowType | undefined) ?? null;
  }, [nodes, selectedNodeId]);

  const filteredVisoes = useMemo(() => {
    const query = hallSearch.trim().toLowerCase();
    if (!query) return visoes;
    return visoes.filter((visao) => visao.nome.toLowerCase().includes(query));
  }, [hallSearch, visoes]);

  const loadVisoes = useCallback(async () => {
    const res = await axios.get(`${API_URL}/visoes`);
    setVisoes(res.data);
  }, []);

  const loadFlow = useCallback(async (visaoId: string) => {
    const res = await axios.get(`${API_URL}/fluxo/${visaoId}`);
    const flowNodes = res.data.nodes as FlowNode[];
    const nodeTypeById = new Map(flowNodes.map((node) => [node.id, node.type]));

    setNodes(flowNodes);
    setEdges(
      res.data.edges.map((edge: Edge) =>
        applyEdgeColor(edge, nodeTypeById.get(edge.source) ?? null)
      )
    );
  }, [setEdges, setNodes]);

  useEffect(() => {
    loadVisoes().catch((error) => alert(error.response?.data?.error || 'Erro ao carregar hall'));
  }, [loadVisoes]);

  useEffect(() => {
    if (mode === 'canvas' && currentVisao) {
      loadFlow(currentVisao.id).catch((error) => alert(error.response?.data?.error || 'Erro ao carregar canvas'));
    } else {
      setNodes([]);
      setEdges([]);
      setSelectedNodeId('');
    }
  }, [currentVisao, loadFlow, mode, setEdges, setNodes]);

  const openHallCreate = useCallback(() => {
    setHallModalMode('create');
    setEditingVisao(null);
    setIsHallModalOpen(true);
  }, []);

  const openHallEdit = useCallback((visao: VisaoItem) => {
    setHallModalMode('edit');
    setEditingVisao(visao);
    setIsHallModalOpen(true);
  }, []);

  const openCanvas = useCallback((visao: VisaoItem) => {
    setCurrentVisao(visao);
    setMode('canvas');
    setCanvasMode('view');
  }, []);

  const closeCanvas = useCallback(() => {
    setMode('hall');
    setCurrentVisao(null);
    setCanvasMode('view');
    setIsNodeModalOpen(false);
    setIsRenameModalOpen(false);
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
    setRenamingNodeId('');
    setRenamingNodeName('');
    setSelectedNodeId('');
  }, []);

  const handleHallSubmit = useCallback(
    async (nome: string) => {
      if (hallModalMode === 'create') {
        await axios.post(`${API_URL}/visoes`, { nome });
      } else if (editingVisao) {
        await axios.patch(`${API_URL}/visoes/${editingVisao.id}`, { nome });
      }

      await loadVisoes();
    },
    [editingVisao, hallModalMode, loadVisoes]
  );

  const handleDeleteVisao = useCallback(
    async (visao: VisaoItem) => {
      setDeleteTarget(visao);
      setIsDeleteModalOpen(true);
    },
    []
  );

  const confirmDeleteVisao = useCallback(async () => {
    if (!deleteTarget) return;

    await axios.delete(`${API_URL}/visoes/${deleteTarget.id}`);
    await loadVisoes();

    if (currentVisao?.id === deleteTarget.id) {
      closeCanvas();
    }

    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
  }, [closeCanvas, currentVisao, deleteTarget, loadVisoes]);

  const handleCreateNode = useCallback(
    async ({ nome, tipo }: { nome: string; tipo: FlowType }) => {
      if (!currentVisao) return;

      const res = await axios.post(`${API_URL}/fluxo/no`, {
        visaoId: currentVisao.id,
        nome,
        tipo
      });

      setNodes((prev) => prev.concat(res.data));
    },
    [currentVisao, setNodes]
  );

  const handleRenameNode = useCallback(
    async (nodeId: string, nextName: string) => {
      await axios.patch(`${API_URL}/fluxo/no/nome`, {
        noId: nodeId,
        nome: nextName
      });

      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, label: nextName }
              }
            : node
        )
      );
    },
    [setNodes]
  );

  const handleRenameSubmit = useCallback(
    async (nextName: string) => {
      if (!renamingNodeId || nextName === renamingNodeName) {
        setIsRenameModalOpen(false);
        return;
      }

      await handleRenameNode(renamingNodeId, nextName).catch((error) =>
        alert(error.response?.data?.error || 'Erro ao renomear item')
      );
      setIsRenameModalOpen(false);
    },
    [handleRenameNode, renamingNodeId, renamingNodeName]
  );

  const openCanvasEditMode = useCallback(() => {
    setCanvasMode('edit');
  }, []);

  const exitCanvasEditMode = useCallback(() => {
    setCanvasMode('view');
    setIsNodeModalOpen(false);
    setIsRenameModalOpen(false);
    setRenamingNodeId('');
    setRenamingNodeName('');
    setSelectedNodeId('');
  }, []);

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      await axios.delete(`${API_URL}/fluxo/no/${nodeId}`);
      setNodes((prev) => prev.filter((node) => node.id !== nodeId));
      setEdges((prev) => prev.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId('');
    },
    [selectedNodeId, setEdges, setNodes]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (canvasMode !== 'edit') return;
      if (!currentVisao || !params.source || !params.target) return;

      const sourceId = params.source;
      const targetId = params.target;
      const sourceNode = nodes.find((node) => node.id === sourceId);
      const targetNode = nodes.find((node) => node.id === targetId);

      if (!sourceNode || !targetNode) return;

      const resolvedHandles = resolveEdgeHandles(sourceNode, targetNode, params);

      axios
        .post(`${API_URL}/fluxo/conexao`, {
          visaoId: currentVisao.id,
          source: sourceId,
          target: targetId
        })
        .then((res) => {
          const sourceNodeType = nodes.find((node) => node.id === sourceId)?.type;
          setEdges((prev) =>
            addEdge(
              applyEdgeColor(
                {
                  ...params,
                  id: res.data.id,
                  source: sourceId,
                  target: targetId,
                  sourceHandle: res.data.sourceHandle ?? resolvedHandles.sourceHandle,
                  targetHandle: res.data.targetHandle ?? resolvedHandles.targetHandle,
                  animated: true
                },
                sourceNodeType
              ),
              prev
            )
          );
        })
        .catch((error) => alert(error.response?.data?.error || 'Erro ao conectar'));
    },
    [canvasMode, currentVisao, nodes, setEdges]
  );

  const onNodeDragStop: NodeDragHandler = useCallback((_event, node) => {
    axios.patch(`${API_URL}/fluxo/no/posicao`, {
      noId: node.id,
      posicao_x: node.position.x,
      posicao_y: node.position.y
    });
  }, []);

  const onNodeDoubleClick = useCallback(
    (_event: ReactMouseEvent, node: Node<FlowNodeData>) => {
      if (canvasMode !== 'edit') return;
      setRenamingNodeId(node.id);
      setRenamingNodeName(node.data.label);
      setIsRenameModalOpen(true);
    },
    [canvasMode]
  );

  const onNodeClick = useCallback((_event: ReactMouseEvent, node: Node<any, string | undefined>) => {
    if (canvasMode !== 'edit') return;
    setSelectedNodeId(node.id);
  }, [canvasMode]);

  const onNodesDelete = useCallback(
    (nodesToDelete: Node<FlowNodeData>[]) => {
      if (canvasMode !== 'edit') return;
      Promise.all(nodesToDelete.map((node) => handleDeleteNode(node.id))).catch((error) =>
        alert(error.response?.data?.error || 'Erro ao remover item')
      );
    },
    [canvasMode, handleDeleteNode]
  );

  const onEdgesDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      if (canvasMode !== 'edit') return;
      Promise.all(edgesToDelete.map((edge) => axios.delete(`${API_URL}/fluxo/conexao/${edge.id}`)))
        .then(() => {
          const deletedIds = edgesToDelete.map((edge) => edge.id);
          setEdges((prev) => prev.filter((edge) => !deletedIds.includes(edge.id)));
        })
        .catch((error) => alert(error.response?.data?.error || 'Erro ao remover conexão'));
    },
    [canvasMode, setEdges]
  );

  const toolbar = useMemo(
    () => (
      <div className="top-toolbar">
        {nodeOptions.map((option) => (
          <div key={option.type} className="toolbar-chip-wrap">
            <button
              type="button"
              className={`toolbar-chip ${selectedNodeType === option.type ? 'active' : ''}`}
              style={{ '--chip-accent': option.accent } as CSSProperties}
              onClick={() => {
                setNodeModalType(option.type);
                setIsNodeModalOpen(true);
              }}
              aria-label={option.label}
            >
              <span>{option.emoji}</span>
            </button>
            <span className="toolbar-tooltip">{option.label}</span>
          </div>
        ))}
      </div>
    ),
    [selectedNodeType]
  );

  if (mode === 'hall') {
    return (
      <div className="app-container hall-screen">
        <section className="hall-shell">
          <header className="hall-header">
            <div className="hall-header-copy">
              <h1 className="hall-title">Repositório aplicação command center</h1>
              <label className="hall-search">
                <span className="hall-search-icon" aria-hidden="true">
                  ⌕
                </span>
                <input
                  type="text"
                  value={hallSearch}
                  onChange={(event) => setHallSearch(event.target.value)}
                  placeholder="Buscar repositório"
                  aria-label="Buscar repositório"
                />
              </label>
            </div>

            <button type="button" className="btn-primary" onClick={openHallCreate}>
              + CRIAR NOVO
            </button>
          </header>

          <div className="hall-stage">
            {visoes.length === 0 ? (
              <div className="empty-hall">
                <div className="empty-hall-icon">📦</div>
                <strong>Nenhum fluxograma criado ainda</strong>
                <p>Comece criando o primeiro painel para abrir o canvas depois.</p>
                <button type="button" className="btn-primary" onClick={openHallCreate}>
                  Criar painel
                </button>
              </div>
            ) : filteredVisoes.length === 0 ? (
              <div className="empty-hall">
                <div className="empty-hall-icon">🔎</div>
                <strong>Nenhum repositório encontrado</strong>
                <p>Não encontrei um nome que combine com a sua busca.</p>
              </div>
            ) : (
              <>
                <div className="hall-featured-column">
                  <HallCard
                    visao={filteredVisoes[0]}
                    onOpen={openCanvas}
                    onEdit={openHallEdit}
                    onDelete={handleDeleteVisao}
                    palette={getHallPalette(filteredVisoes[0].id)}
                    featured
                  />
                </div>

                {filteredVisoes.length > 1 ? (
                  <div className="hall-side-column">
                    {filteredVisoes.slice(1).map((visao) => (
                      <HallCard
                        key={visao.id}
                        visao={visao}
                        onOpen={openCanvas}
                        onEdit={openHallEdit}
                        onDelete={handleDeleteVisao}
                        palette={getHallPalette(visao.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>

        <HallModal
          open={isHallModalOpen}
          title={hallModalMode === 'create' ? 'Novo fluxograma' : 'Editar fluxograma'}
          description={
            hallModalMode === 'create'
              ? 'Dê um nome ao novo painel do hall.'
              : 'Atualize o nome do fluxograma selecionado.'
          }
          initialValue={editingVisao?.nome ?? ''}
          submitLabel={hallModalMode === 'create' ? 'Criar painel' : 'Salvar alterações'}
          onClose={() => setIsHallModalOpen(false)}
          onSubmit={handleHallSubmit}
        />

        <DeleteConfirmModal
          open={isDeleteModalOpen}
          title="Excluir repositório"
          description={`Tem certeza que deseja excluir "${deleteTarget?.nome ?? ''}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
          }}
          onConfirm={confirmDeleteVisao}
        />
      </div>
    );
  }

  return (
    <div className="app-container canvas-screen">
      <div className="canvas-top-actions">
        <button type="button" className="exit-button" onClick={closeCanvas}>
          Sair
        </button>
        <button
          type="button"
          className={`canvas-mode-button ${canvasMode === 'edit' ? 'active' : ''}`}
          onClick={canvasMode === 'edit' ? exitCanvasEditMode : openCanvasEditMode}
        >
          {canvasMode === 'edit' ? 'Visualização' : 'Editar'}
        </button>
      </div>

      {canvasMode === 'edit' ? toolbar : null}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={canvasMode === 'edit'}
        nodesConnectable={canvasMode === 'edit'}
        elementsSelectable={canvasMode === 'edit'}
        nodesFocusable={canvasMode === 'edit'}
        zoomOnDoubleClick={canvasMode === 'edit'}
        fitView
      >
        <CanvasZoomControls />
        <Background color="#2a2f3b" gap={20} size={1} />
      </ReactFlow>

      <NodeModal
        open={isNodeModalOpen}
        initialType={nodeModalType}
        onClose={() => setIsNodeModalOpen(false)}
        onSubmit={handleCreateNode}
      />

      <NodeRenameModal
        open={isRenameModalOpen}
        title="Editar nome do item"
        initialValue={renamingNodeName}
          onClose={() => {
            setIsRenameModalOpen(false);
            setRenamingNodeId('');
            setRenamingNodeName('');
        }}
        onSubmit={handleRenameSubmit}
      />
    </div>
  );
}

