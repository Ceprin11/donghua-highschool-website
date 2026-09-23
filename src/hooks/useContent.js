import { useCallback, useEffect, useState } from "react";

export function useContent(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.resolve().then(loader).then((data) => { if (active) setState({ data, loading: false, error: null }); }).catch((error) => { if (active) setState({ data: null, loading: false, error }); });
    return () => { active = false; };
  }, deps);
  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}
