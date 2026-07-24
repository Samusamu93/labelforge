'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zebra', {
  listTemplates: () => ipcRenderer.invoke('list-templates'),
  loadTemplateRaw: (file) => ipcRenderer.invoke('load-template-raw', file),
  saveTemplate: (file, json) => ipcRenderer.invoke('save-template', { file, json }),
  deleteTemplate: (file) => ipcRenderer.invoke('delete-template', file),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  pickFile: (kind) => ipcRenderer.invoke('pick-file', kind),
  saveFile: (payload) => ipcRenderer.invoke('save-file', payload),
  testConnection: (connection) => ipcRenderer.invoke('test-connection', connection),
  diagnose: (connection) => ipcRenderer.invoke('diagnose', connection),
  qrMatrix: (text) => ipcRenderer.invoke('qr-matrix', text),
  dmImage: (text) => ipcRenderer.invoke('dm-image', text),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (obj) => ipcRenderer.invoke('save-settings', obj),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  openTemplatesFolder: () => ipcRenderer.invoke('open-templates-folder'),
  print: (payload) => ipcRenderer.invoke('print', payload),
});
