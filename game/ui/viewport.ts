/** iOS: страница ужимается до видимой области, когда выезжает клавиатура, без сдвига: поле ввода уже в видимой части, и Safari не двигает страницу (со сдвигом `offsetTop` было хуже) */
export function bindVisualViewport(): () => void {
  const viewport = window.visualViewport;
  if(!viewport) return () => {};
  const body = document.body;
  const apply = () => {
    const shrunk = window.innerHeight - viewport.height > 1;
    body.style.height = shrunk ? viewport.height + "px" : "";
    // Safari мог подвинуть страницу сам: возвращаем на место
    if(window.scrollY || viewport.offsetTop) window.scrollTo(0, 0);
  };
  viewport.addEventListener("resize", apply);
  viewport.addEventListener("scroll", apply);
  apply();
  return () => {
    viewport.removeEventListener("resize", apply);
    viewport.removeEventListener("scroll", apply);
    body.style.height = "";
  };
}
