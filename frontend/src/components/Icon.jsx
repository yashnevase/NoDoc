export function Icon({ name }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.8,
  };
  const shapes = {
    merge: <><path d="M5 4h7l4 4v12H5z" /><path d="M12 4v5h5" /><path d="M8 13h8" /><path d="M8 16h8" /></>,
    split: <><path d="M4 5h6v14H4z" /><path d="M14 5h6v14h-6z" /><path d="M12 8v8" /></>,
    extract: <><path d="M6 4h9l3 3v13H6z" /><path d="M15 4v4h4" /><path d="M10 13h6" /><path d="M13 10v6" /></>,
    trash: <><path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M8 10l1 9h6l1-9" /></>,
    rotate: <><path d="M17 8a6 6 0 1 0 1 6" /><path d="M17 4v4h-4" /></>,
    reorder: <><path d="M7 6h11" /><path d="M7 12h11" /><path d="M7 18h11" /><path d="M4 6h.01" /><path d="M4 12h.01" /><path d="M4 18h.01" /></>,
    batch: <><path d="M7 7h10v12H7z" /><path d="M4 4h10" /><path d="M4 4v12" /></>,
    image: <><path d="M4 5h16v14H4z" /><path d="M8 14l3-3 3 3 2-2 3 4" /><circle cx="9" cy="9" r="1" /></>,
    pdf: <><path d="M6 4h8l4 4v12H6z" /><path d="M14 4v5h5" /><path d="M8 15h8" /><path d="M8 12h4" /></>,
    text: <><path d="M5 6h14" /><path d="M12 6v12" /><path d="M9 18h6" /></>,
    word: <><path d="M4 6h16v12H4z" /><path d="M7 9l1.5 6L11 9l2.5 6L15 9" /></>,
    sheet: <><path d="M4 5h16v14H4z" /><path d="M4 10h16" /><path d="M4 15h16" /><path d="M10 5v14" /></>,
    stamp: <><path d="M9 4h6l1 7H8z" /><path d="M6 15h12v5H6z" /><path d="M8 15v-2h8v2" /></>,
    draw: <><path d="M4 18c4-7 8-7 16-2" /><path d="M14 4l6 6" /><path d="M13 5l-5 9 9-5" /></>,
    highlight: <><path d="M5 17h14" /><path d="M8 14l7-9 4 3-7 9z" /></>,
    sign: <><path d="M4 17c3-6 5 3 8-2 2-4 3 1 8-1" /><path d="M16 4l4 4" /><path d="M15 5l-4 7" /></>,
    redact: <><path d="M5 7h14" /><path d="M5 12h14" /><path d="M5 17h14" /><path d="M7 10h10v4H7z" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    shield: <><path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></>,
    key: <><circle cx="8" cy="15" r="3" /><path d="M11 15h9" /><path d="M17 15v-3" /><path d="M14 15v-2" /></>,
    scan: <><path d="M4 8V5h3" /><path d="M17 5h3v3" /><path d="M20 16v3h-3" /><path d="M7 19H4v-3" /><path d="M7 12h10" /></>,
    search: <><circle cx="10" cy="10" r="5" /><path d="M14 14l5 5" /></>,
    reader: <><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v5h4" /><path d="M8 12h8" /><path d="M8 16h6" /></>,
    tag: <><path d="M4 12V5h7l9 9-7 7z" /><circle cx="8" cy="8" r="1" /></>,
    repair: <><path d="M14 5l5 5-9 9H5v-5z" /><path d="M12 7l5 5" /></>,
    compare: <><path d="M5 5h7v14H5z" /><path d="M12 8h7v11h-7" /></>,
    archive: <><path d="M5 7h14v13H5z" /><path d="M4 4h16v3H4z" /><path d="M10 11h4" /></>,
    folder: <><path d="M3.5 7.5h6l2 2h9v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M3.5 7.5v-1a2 2 0 0 1 2-2h3l2 2h8a2 2 0 0 1 2 2v1" /></>,
    openExternal: <><path d="M14 5h5v5" /><path d="M10 14 19 5" /><path d="M19 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></>,
    upload: <><path d="M12 17V5" /><path d="M7 10l5-5 5 5" /><path d="M5 19h14" /></>,
    download: <><path d="M12 5v12" /><path d="M7 12l5 5 5-5" /><path d="M5 19h14" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
    reload: <><path d="M19 8a7 7 0 1 0 1 6" /><path d="M19 4v4h-4" /></>,
    check: <><path d="M5 12l4 4L19 6" /></>,
    copy: <><path d="M8 8h10v11H8z" /><path d="M6 5h10v3" /></>,
    settings: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7z" /><path d="M19 12l2-1-1-3-2 .2-.9-1.6 1.2-1.7-2.2-2.2-1.7 1.2-1.6-.9.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2-1.6.9-1.7-1.2-2.2 2.2 1.2 1.7-.9 1.6-2-.2-1 3 2 1v1.8l-2 1 1 3 2-.2.9 1.6-1.2 1.7 2.2 2.2 1.7-1.2 1.6.9-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.6-.9 1.7 1.2 2.2-2.2-1.2-1.7.9-1.6 2 .2 1-3-2-1z" /></>,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
    history: <><path d="M12 7v5l3 2" /><path d="M5 12a7 7 0 1 0 2-4.9" /><path d="M5 4v4h4" /></>,
    undo: <><path d="M9 7 5 11l4 4" /><path d="M5 11h8a6 6 0 0 1 6 6" /></>,
    redo: <><path d="m15 7 4 4-4 4" /><path d="M19 11h-8a6 6 0 0 0-6 6" /></>,
    chevronLeft: <><path d="M15 5l-7 7 7 7" /></>,
    chevronRight: <><path d="M9 5l7 7-7 7" /></>,
    zoomIn: <><circle cx="10" cy="10" r="5" /><path d="M14 14l5 5" /><path d="M10 7v6" /><path d="M7 10h6" /></>,
    zoomOut: <><circle cx="10" cy="10" r="5" /><path d="M14 14l5 5" /><path d="M7 10h6" /></>,
    fitWidth: <><path d="M4 6v12" /><path d="M20 6v12" /><path d="M7 12h10" /><path d="M9 9l-3 3 3 3" /><path d="M15 9l3 3-3 3" /></>,
    fitPage: <><rect x="6" y="3" width="12" height="18" rx="1" /><path d="M9 8l-2 2" /><path d="M15 8l2 2" /><path d="M9 16l-2-2" /><path d="M15 16l2-2" /></>,
    edit: <><path d="M4 20l4.5-1 10-10-3.5-3.5-10 10z" /><path d="M13.5 6.5l3.5 3.5" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>
      {shapes[name] || shapes.pdf}
    </svg>
  );
}
