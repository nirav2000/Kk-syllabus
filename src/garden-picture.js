import { rectangle } from './garden-model.js';

// Intrinsic SVG dimensions and explicit tile coordinates avoid relying on
// empty HTML grid items to acquire a height. Paint is part of the diagram,
// so tiles remain visible even when a stylesheet is stale or unavailable.
export function gardenPicture(width, height, mode = 'area', edge = 0) {
  rectangle(width, height);
  const unit = 32, pad = 5, w = width * unit, h = height * unit;
  const tiles = Array.from({ length: width * height }, (_, i) =>
    `<rect data-tile="${i}" x="${pad + (i % width) * unit}" y="${pad + Math.floor(i / width) * unit}" width="${unit}" height="${unit}" fill="${mode === 'edge' ? '#edf3ef' : '#c5e1d2'}" stroke="#648d78" stroke-width="1"/>`
  ).join('');
  const sides = [[pad,pad,pad+w,pad],[pad+w,pad,pad+w,pad+h],[pad+w,pad+h,pad,pad+h],[pad,pad+h,pad,pad]];
  const [x1,y1,x2,y2] = sides[((edge % 4) + 4) % 4];
  const highlight = mode === 'edge' ? `<line data-boundary="true" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#874808" stroke-width="5"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="garden-diagram" width="${w + 2*pad}" height="${h + 2*pad}" viewBox="0 0 ${w + 2*pad} ${h + 2*pad}" role="img" aria-label="${width} by ${height} rectangle with ${width*height} one-square-metre tiles" style="display:block;width:${(w+2*pad)/(12*unit+2*pad)*100}%;max-width:100%;height:auto;margin:16px auto"><title>${width} by ${height} square tiles</title>${tiles}${highlight}</svg>`;
}
