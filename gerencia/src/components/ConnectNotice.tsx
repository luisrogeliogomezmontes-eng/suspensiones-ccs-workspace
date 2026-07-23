// Aviso amable cuando la app no puede leer Notion (falta compartir las BDs con la integración).

export function ConnectNotice({ error }: { error: string }) {
  const accessIssue = /object_not_found|Could not find|share/i.test(error);
  return (
    <div className="card mx-auto mt-10 max-w-xl p-6">
      <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
        {accessIssue ? "Falta conectar Notion" : "No se pudo leer Notion"}
      </h2>
      {accessIssue ? (
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm" style={{ color: "var(--ink-dim)" }}>
          <li>Abre la página raíz del depto en Notion (el hub “Electronica — Suspensiones Caracas”).</li>
          <li>Menú <b>⋯</b> → <b>Conexiones</b> (Connections) → agrega la integración <b>“Rogelio Claude”</b>.</li>
          <li>Eso da acceso a todas las BDs hijas (Comandas, Etapas, Inventario, BOM, Proyectos).</li>
          <li>Recarga esta página.</li>
        </ol>
      ) : (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-dim)" }}>
          Revisa que <code>NOTION_TOKEN</code> y los <code>NOTION_DS_*</code> estén bien en el entorno.
        </p>
      )}
      <pre
        className="mt-4 overflow-x-auto rounded-lg p-3 text-xs"
        style={{ background: "var(--panel-2)", color: "var(--ink-faint)", border: "1px solid var(--border)" }}
      >
        {error}
      </pre>
    </div>
  );
}
