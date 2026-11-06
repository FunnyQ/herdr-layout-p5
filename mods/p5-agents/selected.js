// A focused side pane (yazi, a shell) selects its tab's first agent.
export const markSelected = (list, tab) => {
  const sel =
    list.find((a) => a.focused) ?? list.find((a) => tab && a.tab === tab);
  return list.map((a) => ({ ...a, focused: a === sel }));
};
