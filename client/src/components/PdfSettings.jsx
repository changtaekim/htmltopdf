const PRESET_SIZES = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Custom'];

export default function PdfSettings({ settings, onChange }) {
  const { pageSize, width, height, unit } = settings;

  const handlePageSizeChange = (e) => {
    onChange({ ...settings, pageSize: e.target.value });
  };

  return (
    <div className="settings-container">
      <h3 className="section-title">PDF 출력 설정</h3>
      <div className="setting-row">
        <label htmlFor="pageSize">페이지 크기</label>
        <select id="pageSize" value={pageSize} onChange={handlePageSizeChange}>
          {PRESET_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {pageSize === 'Custom' && (
        <div className="custom-size">
          <div className="setting-row">
            <label htmlFor="width">너비</label>
            <div className="input-with-unit">
              <input
                id="width"
                type="number"
                min="1"
                value={width}
                onChange={(e) => onChange({ ...settings, width: e.target.value })}
                placeholder="예: 210"
              />
              <select
                value={unit}
                onChange={(e) => onChange({ ...settings, unit: e.target.value })}
              >
                <option value="mm">mm</option>
                <option value="px">px</option>
              </select>
            </div>
          </div>
          <div className="setting-row">
            <label htmlFor="height">높이</label>
            <div className="input-with-unit">
              <input
                id="height"
                type="number"
                min="1"
                value={height}
                onChange={(e) => onChange({ ...settings, height: e.target.value })}
                placeholder="예: 297"
              />
              <span className="unit-display">{unit}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
