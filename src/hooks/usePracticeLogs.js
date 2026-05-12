// =============================================================================
// usePracticeLogs — Firebase болон offline горим дэмжинэ
// =============================================================================
import { useEffect, useState } from "react";
import { isFirebaseConfigured, subscribePracticeLogs } from "../lib/firebase";
const KEY = "champstep.practiceLogs.v1";
function loadLocal(childId) {
    try {
        const raw = localStorage.getItem(`${KEY}.${childId}`);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
function saveLocal(childId, logs) {
    localStorage.setItem(`${KEY}.${childId}`, JSON.stringify(logs));
}
export function usePracticeLogs(childId) {
    const [logs, setLogs] = useState(() => isFirebaseConfigured ? [] : loadLocal(childId));
    const [loading, setLoading] = useState(isFirebaseConfigured);
    useEffect(() => {
        if (!childId)
            return;
        if (!isFirebaseConfigured) {
            setLogs(loadLocal(childId));
            setLoading(false);
            return;
        }
        setLoading(true);
        const unsub = subscribePracticeLogs(childId, (items) => {
            setLogs(items);
            setLoading(false);
        });
        return unsub;
    }, [childId]);
    function addLocal(log) {
        setLogs((prev) => {
            const next = [log, ...prev];
            saveLocal(childId, next);
            return next;
        });
    }
    function removeLocal(id) {
        setLogs((prev) => {
            const next = prev.filter((l) => l.id !== id);
            saveLocal(childId, next);
            return next;
        });
    }
    return { logs, loading, addLocal, removeLocal };
}
