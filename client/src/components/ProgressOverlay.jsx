export default function ProgressOverlay() {
  return (
    <div className="overlay">
      <div className="overlay-content">
        <div className="spinner" />
        <p>PDF 변환 중...</p>
        <p className="overlay-hint">파일 수에 따라 시간이 걸릴 수 있습니다.</p>
      </div>
    </div>
  );
}
