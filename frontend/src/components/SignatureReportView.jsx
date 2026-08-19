export function SignatureReportView({ signatureBusy, signatureReport }) {
  return (
    <div className="signature-report">
      <div className="signature-report-head">
        <div>
          <strong>Signature check</strong>
          <span>
            {signatureBusy
              ? "Inspecting document"
              : signatureReport
                ? `${signatureReport.signature_count} field${signatureReport.signature_count === 1 ? "" : "s"} found`
                : "No report yet"}
          </span>
        </div>
        <div className={`signature-pill is-${signatureReport?.status || "idle"}`}>
          {signatureBusy
            ? "Checking"
            : signatureReport
              ? signatureReport.status === "signed"
                ? "Signed"
                : signatureReport.status === "unsigned"
                  ? "Needs review"
                  : "None found"
              : "Ready"}
        </div>
      </div>

      {signatureBusy ? (
        <div className="signature-empty">
          <span />
          <p>Reading signature fields and validation markers</p>
        </div>
      ) : signatureReport ? (
        <div className="signature-report-body">
          <div className="signature-summary">
            <strong>{signatureReport.document_signed ? "Signature present" : "No valid signature yet"}</strong>
            <p>
              {signatureReport.document_signed
                ? "The file contains signature fields with ByteRange and Contents data."
                : signatureReport.signature_count
                  ? "Signature fields exist, but they are incomplete or need review."
                  : "No signature fields were detected in this document."}
            </p>
          </div>
          <div className="signature-field-list">
            {signatureReport.fields.length ? (
              signatureReport.fields.map((field) => (
                <article key={field.name} className="signature-field-card">
                  <div className="signature-field-head">
                    <strong>{field.name}</strong>
                    <span className={field.signed ? "is-signed" : "is-warning"}>
                      {field.signed ? "Structure OK" : "Attention"}
                    </span>
                  </div>
                  <p>{field.filter || "No filter"}{field.subfilter ? ` | ${field.subfilter}` : ""}</p>
                  {field.issues.length > 0 && <em>{field.issues.join(", ")}</em>}
                </article>
              ))
            ) : (
              <div className="signature-empty compact">
                <p>No signature fields detected.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="signature-empty">
          <p>Open a PDF to inspect signatures.</p>
        </div>
      )}
    </div>
  );
}
