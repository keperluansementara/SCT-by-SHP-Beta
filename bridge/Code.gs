// ============================================================
// SCT Bridge — Google Apps Script
// File: Code.gs
//
// Deploy settings (Apps Script > Deploy > New deployment):
//   Type        : Web app
//   Execute as  : Me (your Google account)
//   Who has access: Anyone
//
// After deploying, copy the /exec URL into SCT dashboard
// Source Status panel > Bridge URL input field.
//
// Script Properties (Apps Script > Project Settings > Script Properties):
//   Key   : FILE_ID
//   Value : your Drive file ID
//   e.g.  : 1TH8JSKf4wvUqXARPqaaQcF6GF2bV8ZOp
// ============================================================

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

    if (!action) {
      return respond({ ok: true, message: 'SCT Bridge Online' });
    }
    if (action === 'meta') {
      return handleMeta();
    }
    if (action === 'download') {
      return handleDownload();
    }
    return respond({ ok: false, error: 'UNKNOWN_ACTION',
                     message: 'Unrecognised action: ' + action });

  } catch (err) {
    return respond({ ok: false, error: 'SERVER_ERROR', message: String(err) });
  }
}

function getFileId() {
  var props  = PropertiesService.getScriptProperties();
  var fileId = props.getProperty('FILE_ID');
  if (!fileId) {
    throw new Error('FILE_ID not set in Script Properties.');
  }
  return fileId;
}

function handleMeta() {
  var fileId = getFileId();
  var file   = DriveApp.getFileById(fileId);
  return respond({
    ok:           true,
    fileId:       fileId,
    filename:     file.getName(),
    modifiedTime: file.getLastUpdated().toISOString(),
    size:         file.getSize()
  });
}

function handleDownload() {
  var fileId  = getFileId();
  var file    = DriveApp.getFileById(fileId);
  var content = Utilities.base64Encode(file.getBlob().getBytes());
  return respond({
    ok:           true,
    fileId:       fileId,
    filename:     file.getName(),
    modifiedTime: file.getLastUpdated().toISOString(),
    content:      content
  });
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
