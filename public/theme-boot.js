// Apply the saved theme before first paint (dark by default).
// Blue unless a person picked something (red is saved as an empty string).
var a = "blue"; try { var s = localStorage.getItem("pooleanIntelAccent"); if (s !== null) a = s } catch (e) {}
if (a) document.documentElement.setAttribute("data-accent", a)
try { if (localStorage.getItem("pooleanIntelTheme") !== "light") document.documentElement.classList.add("dark") } catch (e) { document.documentElement.classList.add("dark") }
