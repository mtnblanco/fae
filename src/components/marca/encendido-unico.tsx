/**
 * El cartel se enciende a saltos UNA vez por sesión. Este script corre antes de
 * pintar: si ya se encendió en esta sesión, marca <html data-encendido> y el CSS
 * deja la "F" prendida sin animación. Sin sessionStorage (modo privado), se
 * enciende siempre, que también está bien.
 */
const SCRIPT = `try{var k="fae:encendido";if(sessionStorage.getItem(k))document.documentElement.setAttribute("data-encendido","");else sessionStorage.setItem(k,"1")}catch(e){}`;

export function EncendidoUnico() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
