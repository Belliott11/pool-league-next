// Flip-dot digits: <span data-flip="42"></span> becomes a grid of discs. Call flipDots.set(el, "57") to change it,
// and only the discs that change state flip over. Size it with font-size; the digits are 0.8em tall.
const G = {
  "0": ["01110","10001","10011","10101","11001","10001","01110"], "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"], "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"], "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"], "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"], "9": ["01110","10001","10001","01111","00001","00010","01100"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"], ".": ["0","0","0","0","0","0","1"],
}
const NS = "http://www.w3.org/2000/svg"
function cells(text) {
  const out = []; let x = 0
  for (const ch of String(text)) { const g = G[ch]; if (!g) continue
    for (let r = 0; r < 7; r++) for (let c = 0; c < g[r].length; c++) out.push({ x: x + c, y: r, on: g[r][c] === "1" })
    x += g[0].length + 1 }
  return { out, width: Math.max(1, x - 1) }
}
export const flipDots = {
  set(el, text, animate = true) {
    const { out, width } = cells(text)
    el.setAttribute("role", "img"); el.setAttribute("aria-label", String(text))
    const old = new Map([...el.querySelectorAll("circle")].map((c) => [c.dataset.k, c]))
    const svg = el.querySelector("svg") || el.appendChild(Object.assign(document.createElementNS(NS, "svg"), {}))
    svg.setAttribute("viewBox", `0 0 ${width} 7`); svg.setAttribute("fill", "currentColor")
    svg.style.cssText = "height:.8em;width:auto;display:inline-block"
    svg.replaceChildren(...out.map((c) => {
      const k = `${c.x}-${c.y}-${c.on ? 1 : 0}`
      const dot = document.createElementNS(NS, "circle")
      Object.assign(dot.dataset, { k }); dot.setAttribute("cx", c.x + .5); dot.setAttribute("cy", c.y + .5); dot.setAttribute("r", .42)
      dot.setAttribute("opacity", c.on ? 1 : .13)
      if (animate && !old.has(k)) { dot.classList.add("flip-dot"); dot.style.setProperty("--c", c.x) }
      return dot
    }))
  },
  init(root = document) { root.querySelectorAll("[data-flip]").forEach((el) => flipDots.set(el, el.dataset.flip, false)) },
}
