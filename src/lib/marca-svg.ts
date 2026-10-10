/**
 * El poste de barbero como SVG en texto, para generar íconos e imágenes
 * (next/og no usa componentes de React con hooks).
 */
export function svgPoste(): string {
  const franjas = [-6, 4, 14, 24]
    .map(
      (y, i) =>
        `<polygon points="7,${y + 10} 17,${y} 17,${y + 4} 7,${y + 14}" fill="${i % 2 === 0 ? "#8e2f2b" : "#c9a15b"}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 40">
<defs><clipPath id="c"><rect x="7" y="7" width="10" height="26" rx="1.5"/></clipPath>
<linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="#8a6a33"/><stop offset=".45" stop-color="#e2c27f"/><stop offset="1" stop-color="#8a6a33"/></linearGradient></defs>
<rect x="5" y="1" width="14" height="5" rx="2.5" fill="url(#m)"/>
<g clip-path="url(#c)"><rect x="7" y="7" width="10" height="26" fill="#eee6d8"/>${franjas}</g>
<rect x="5" y="34" width="14" height="5" rx="2.5" fill="url(#m)"/></svg>`;
}

export const svgPosteDataUri = () =>
  `data:image/svg+xml;base64,${Buffer.from(svgPoste()).toString("base64")}`;
