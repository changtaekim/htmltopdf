import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ file, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="file-item">
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <span className="file-name">{file.name}</span>
      <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
      <button
        className="remove-btn"
        onClick={() => onRemove(file.id)}
        title="파일 제거"
      >
        ✕
      </button>
    </li>
  );
}

export default function FileList({ files, onReorder, onRemove }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((f) => f.id === active.id);
      const newIndex = files.findIndex((f) => f.id === over.id);
      onReorder(arrayMove(files, oldIndex, newIndex));
    }
  };

  if (files.length === 0) return null;

  return (
    <div className="file-list-container">
      <h3 className="section-title">업로드된 파일 ({files.length}개) — 드래그하여 순서 변경</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={files.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ul className="file-list">
            {files.map((file) => (
              <SortableItem key={file.id} file={file} onRemove={onRemove} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
