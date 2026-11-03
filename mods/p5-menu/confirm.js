export function closeRequest(spaces, panes, name, id) {
  const space = spaces.find((s) =>
    name === "space.close" ? s.id === id : s.tabs.some((t) => t.id === id),
  );
  if (!space || (name === "tab.close" && space.tabs.length > 1)) return null;
  const tabs = new Set(space.tabs.map((t) => t.id));
  const count = panes.filter((p) => tabs.has(p.tab) && p.terminal).length;
  return {
    title: "Close space?",
    detail: `${space.name} — ${tabs.size} ${tabs.size === 1 ? "tab" : "tabs"}, ${count} ${count === 1 ? "terminal" : "terminals"}`,
    command: { name, args: { id, confirmed: true } },
  };
}
