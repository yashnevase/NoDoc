import { useEffect } from "react";

import { canUseDesktopBridge, getJobHistory, getRecentFiles, saveRecentFiles } from "../api";
import { groups, historyKey, outputFolderKey, recentFilesKey, settingsKey } from "../config/tools";
import { clamp, pathName, readStoredList } from "../utils/fileHelpers";

export function useWorkspacePersistence({
  activeGroup,
  activeTool,
  compressPreset,
  jobHistory,
  readerZoom,
  recentFiles,
  rotateScope,
  rotation,
  setActiveGroup,
  setActiveTool,
  setCompressPreset,
  setJobHistory,
  setOutputFolder,
  setReaderZoom,
  setRecentFiles,
  setRotateScope,
  setRotation,
  setWatermarkAngle,
  setWatermarkColor,
  setWatermarkMode,
  setWatermarkOpacity,
  setWatermarkPosition,
  setWatermarkPreset,
  setWatermarkScope,
  setWatermarkSize,
  outputFolder,
  watermarkAngle,
  watermarkColor,
  watermarkMode,
  watermarkOpacity,
  watermarkPosition,
  watermarkPreset,
  watermarkScope,
  watermarkSize,
}) {
  useEffect(() => {
    const savedPreferences = window.localStorage.getItem(settingsKey);
    if (savedPreferences) {
      try {
        const preferences = JSON.parse(savedPreferences);
        if (preferences.activeGroup && groups.some((group) => group.id === preferences.activeGroup)) {
          setActiveGroup(preferences.activeGroup);
          const savedGroup = groups.find((group) => group.id === preferences.activeGroup);
          const savedTool = savedGroup?.tools.find((tool) => tool.id === preferences.activeTool);
          const fallbackTool = savedGroup?.tools.find((tool) => tool.status === "ready")?.id || savedGroup?.tools[0]?.id || "render";
          setActiveTool(savedTool?.id || fallbackTool);
        }
        if ([0, 90, 180, 270].includes(preferences.rotation)) {
          setRotation(preferences.rotation);
        }
        if (typeof preferences.readerZoom === "number") {
          setReaderZoom(clamp(preferences.readerZoom, 0.8, 1.8));
        }
        if (["balanced", "small", "max"].includes(preferences.compressPreset)) {
          setCompressPreset(preferences.compressPreset);
        }
        if (["selected", "all"].includes(preferences.rotateScope)) {
          setRotateScope(preferences.rotateScope);
        }
        if (["selected", "all"].includes(preferences.watermarkScope)) {
          setWatermarkScope(preferences.watermarkScope);
        }
        if (["text", "badge", "image"].includes(preferences.watermarkMode)) {
          setWatermarkMode(preferences.watermarkMode);
        }
        if (["verified", "question"].includes(preferences.watermarkPreset)) {
          setWatermarkPreset(preferences.watermarkPreset);
        }
        if (["center", "top-left", "top-right", "bottom-left", "bottom-right"].includes(preferences.watermarkPosition)) {
          setWatermarkPosition(preferences.watermarkPosition);
        }
        if (typeof preferences.watermarkAngle === "number") {
          setWatermarkAngle(preferences.watermarkAngle);
        }
        if (typeof preferences.watermarkSize === "number") {
          setWatermarkSize(preferences.watermarkSize);
        }
        if (typeof preferences.watermarkOpacity === "number") {
          setWatermarkOpacity(preferences.watermarkOpacity);
        }
        if (typeof preferences.watermarkColor === "string") {
          setWatermarkColor(preferences.watermarkColor);
        }
      } catch {
        window.localStorage.removeItem(settingsKey);
      }
    }

    setOutputFolder(window.localStorage.getItem(outputFolderKey) || "");
  }, []);

  useEffect(() => {
    async function loadPersistentState() {
      if (!canUseDesktopBridge()) {
        setJobHistory(readStoredList(historyKey));
        setRecentFiles(readStoredList(recentFilesKey));
        return;
      }

      try {
        const [historyResponse, recentResponse] = await Promise.all([getJobHistory(), getRecentFiles()]);
        setJobHistory((historyResponse.items || []).map((item) => ({
          id: item.id,
          createdAt: Date.parse(item.created_at) || Date.now(),
          tool: groups.flatMap((group) => group.tools).find((tool) => tool.id === item.kind)?.title || item.kind,
          paths: item.output_path ? [item.output_path] : [],
          outputs: item.output_path ? [pathName(item.output_path)] : [],
          count: item.output_path ? 1 : 0,
        })));
        setRecentFiles(recentResponse.names || []);
      } catch {
        setJobHistory(readStoredList(historyKey));
        setRecentFiles(readStoredList(recentFilesKey));
      }
    }

    void loadPersistentState();

    function handleReady() {
      void loadPersistentState();
    }

    window.addEventListener("nodoc-ready", handleReady);
    return () => {
      window.removeEventListener("nodoc-ready", handleReady);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      settingsKey,
      JSON.stringify({
        activeGroup,
        activeTool,
        readerZoom,
        rotation,
        compressPreset,
        rotateScope,
        watermarkScope,
        watermarkMode,
        watermarkPreset,
        watermarkPosition,
        watermarkAngle,
        watermarkSize,
        watermarkOpacity,
        watermarkColor,
      })
    );
  }, [activeGroup, activeTool, readerZoom, rotation, compressPreset, rotateScope, watermarkScope, watermarkMode, watermarkPreset, watermarkPosition, watermarkAngle, watermarkSize, watermarkOpacity, watermarkColor]);

  useEffect(() => {
    if (outputFolder) {
      window.localStorage.setItem(outputFolderKey, outputFolder);
      return;
    }
    window.localStorage.removeItem(outputFolderKey);
  }, [outputFolder]);

  useEffect(() => {
    window.localStorage.setItem(historyKey, JSON.stringify(jobHistory));
  }, [jobHistory]);

  useEffect(() => {
    window.localStorage.setItem(recentFilesKey, JSON.stringify(recentFiles));
  }, [recentFiles]);

  function rememberRecentFiles(names) {
    if (!names.length) {
      return;
    }
    setRecentFiles((current) => {
      const merged = [...names, ...current].filter(Boolean);
      const next = [...new Set(merged)].slice(0, 10);
      if (canUseDesktopBridge()) {
        void saveRecentFiles(next).catch(() => {});
      } else {
        window.localStorage.setItem(recentFilesKey, JSON.stringify(next));
      }
      return next;
    });
  }

  function pushHistoryEntry(toolId, paths) {
    const toolTitle = groups.flatMap((group) => group.tools).find((tool) => tool.id === toolId)?.title || toolId;
    const entry = {
      id: `${Date.now()}-${toolId}`,
      createdAt: Date.now(),
      tool: toolTitle,
      toolId,
      paths,
      outputs: paths.map((path) => pathName(path)),
      count: paths.length,
    };
    setJobHistory((current) => {
      const next = [entry, ...current].slice(0, 12);
      if (!canUseDesktopBridge()) {
        window.localStorage.setItem(historyKey, JSON.stringify(next));
      }
      return next;
    });
  }

  return { pushHistoryEntry, rememberRecentFiles };

}
