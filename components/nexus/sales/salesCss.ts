/** Shared CSS for the Sales board, deal panel and deal page (raw string, injected once per screen). */
import { FONT, PAGE_BG } from '@/components/nexus/tasks/shared'

export const SALES_CSS = `
.sb-root{position:fixed;inset:0;z-index:92;overflow-y:auto;${PAGE_BG}color:#1D1D1F;font-family:${FONT};font-size:14px;line-height:1.45;letter-spacing:-.01em;-webkit-overflow-scrolling:touch}
.sb-root *{box-sizing:border-box}
.sb-root a{color:#0071E3;text-decoration:none}
.sb-main{max-width:1680px;margin:0 auto;padding:20px 28px calc(64px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px}
.sb-root.panel-open .sb-main{padding-right:500px}
.sb-back{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 4px;border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer}
.sb-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.sb-hd h1{margin:0;color:#fff;font-size:28px;font-weight:600;letter-spacing:-.02em}
.sb-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.sb-seg{display:inline-flex;gap:4px;padding:3px;border-radius:10px;background:rgba(255,255,255,.12)}
.sb-seg button{min-height:34px;display:inline-flex;align-items:center;gap:6px;padding:0 14px;border-radius:8px;border:0;background:none;font:500 13px ${FONT};color:#C9D2E0;cursor:pointer}
.sb-seg button[aria-pressed=true]{background:#fff;color:#1D1D1F;font-weight:600}
.sb-seg b{font-weight:600;opacity:.65}
.sb-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:0 14px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:#1D1D1F;font:600 13px ${FONT};cursor:pointer;white-space:nowrap}
.sb-btn.sm{min-height:30px;padding:0 10px;font-size:12px;border-radius:8px}
.sb-btn.pri{background:#0071E3;border-color:#0071E3;color:#fff}.sb-btn.pri:hover{background:#0058B0}
.sb-btn.green{background:#248A3D;border-color:#248A3D;color:#fff}
.sb-btn.red{background:#D70015;border-color:#D70015;color:#fff}
.sb-btn:disabled{opacity:.5;cursor:default}
.sb-root a.sb-btn{color:#1D1D1F}
.sb-chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(0,0,0,.12);background:#fff;font:500 13px ${FONT};color:#3A3A3C;cursor:pointer}
.sb-chip[aria-pressed=true]{background:#1D1D1F;border-color:#1D1D1F;color:#fff}
.sb-chip b{font-weight:600}
.sb-in{font:400 13px ${FONT};min-height:34px;padding:0 10px;border:1px solid rgba(0,0,0,.14);border-radius:8px;background:#fff;color:#1D1D1F;width:100%}
textarea.sb-in{padding:8px 10px;resize:vertical;line-height:1.45}
.sb-in:focus{outline:2px solid #0071E3;outline-offset:-1px;border-color:transparent}
select.sb-in{width:auto}
.sb-bar .sb-in{width:auto}
.sb-lbl{color:#C9D2E0;font-size:13px}
.sb-sub{color:#6E6E73;font-size:12.5px}
.sb-sr{position:absolute;left:-9999px}
.sb-err{margin-top:10px;padding:9px 12px;border-radius:10px;background:#FDECEA;color:#8A1209;font-size:13px}
.sb-empty{padding:32px;text-align:center;color:#6E6E73;background:#fff;border-radius:12px}
.sb-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.sb-stat{background:#fff;border-radius:12px;padding:12px 16px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);text-align:left;border:0;font:inherit;color:inherit}
.sb-stat .l{font-size:12px;color:#6E6E73;font-weight:500}.sb-stat .v{font-size:22px;font-weight:600;letter-spacing:-.02em;margin-top:2px}.sb-stat .s{font-size:12px;color:#6E6E73}
.sb-stat .s.r{color:#D70015}
.sb-cols{display:grid;grid-template-columns:repeat(6,minmax(232px,1fr));gap:12px;align-items:start;overflow-x:auto;padding-bottom:6px}
.sb-col{background:rgba(220,227,238,.92);border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:8px;min-width:0;min-height:120px;transition:background .12s}
.sb-col.over{background:#DCE8F8;outline:2px dashed #0071E3;outline-offset:-2px}
.sb-ch{padding:6px 6px 4px}
.sb-ch .t{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}
.sb-ch .n{font-weight:500;color:#6E6E73}.sb-ch .p{font-size:11px;color:#6E6E73;font-weight:500}
.sb-ch .m{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#3A3A3C;margin-top:3px}.sb-ch .m span{color:#6E6E73}
.sb-prob{height:3px;border-radius:2px;background:rgba(0,0,0,.08);margin-top:6px;overflow:hidden}.sb-prob i{display:block;height:100%;background:#0071E3}
.sb-card{display:flex;flex-direction:column;gap:7px;width:100%;text-align:left;background:#fff;border-radius:10px;padding:11px 12px;border:1px solid rgba(0,0,0,.04);box-shadow:0 1px 2px rgba(0,0,0,.06);font:inherit;color:inherit;cursor:pointer}
.sb-card:hover{box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 16px -8px rgba(0,0,0,.25)}
.sb-card:focus-visible{outline:2px solid #0071E3;outline-offset:1px}
.sb-card.rot{box-shadow:inset 3px 0 0 #FF3B30,0 1px 2px rgba(0,0,0,.06)}
.sb-card.sel{outline:2px solid #0071E3;outline-offset:-1px}
.sb-card.drag{opacity:.45}
.sb-ct{font-size:14px;font-weight:600;line-height:1.3;word-break:break-word}
.sb-ca{font-size:12px;color:#6E6E73;margin-top:-4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-money{display:flex;align-items:baseline;gap:6px;font-variant-numeric:tabular-nums;flex-wrap:wrap}.sb-money b{font-size:14px;font-weight:600}.sb-money span{font-size:12px;color:#6E6E73}
.sb-act{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:500;padding:2px 7px;border-radius:6px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:max-content}
.sb-act.ok{background:#EEF4FF;color:#0058B0}.sb-act.late{background:#FFECEC;color:#D70015}.sb-act.none{background:#FFF4E5;color:#B25000}.sb-act.today{background:#E8F6EC;color:#1A7F37}
.sb-cf{display:flex;align-items:center;gap:8px;font-size:12px;color:#6E6E73}
.sb-av{width:22px;height:22px;border-radius:50%;background:#2C3A55;color:#fff;font-size:9.5px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none;vertical-align:middle}
.sb-co{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:#3A3A3C}
.sb-sub2{padding:8px 16px;background:#F5F6F8;font-size:12.5px;font-weight:600;color:#3A3A3C;border-top:1px solid rgba(0,0,0,.06)}
.sb-days.r{color:#D70015;font-weight:600}
.sb-add{min-height:36px;border:0;border-radius:8px;background:none;color:#6E6E73;font:500 13px ${FONT};text-align:left;padding:0 8px;cursor:pointer}.sb-add:hover{background:rgba(0,0,0,.05)}
.sb-drops{position:sticky;bottom:12px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .15s,transform .15s;z-index:3}
.sb-drops.on{opacity:1;pointer-events:auto;transform:none}
.sb-drop{height:64px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;border:2px dashed;box-shadow:0 10px 30px rgba(10,20,40,.18)}
.sb-drop.won{background:#E8F6EC;border-color:#30A14E;color:#1A7F37}.sb-drop.lost{background:#FFECEC;border-color:#FF3B30;color:#D70015}.sb-drop.arch{background:#F2F2F4;border-color:#AEAEB2;color:#3A3A3C}
.sb-drop.over{transform:scale(1.02);border-style:solid}
.sb-tbl{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08)}
.sb-tw{overflow-x:auto}
.sb-tbl table{width:100%;min-width:900px;border-collapse:collapse;font-size:13px}
.sb-tbl th{text-align:left;font-weight:500;color:#6E6E73;font-size:12px;padding:9px 12px;border-bottom:1px solid rgba(0,0,0,.08);white-space:nowrap;background:#FBFBFD}
.sb-tbl td{padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.05);white-space:nowrap;vertical-align:middle}
.sb-tbl tr:last-child td{border-bottom:0}.sb-tbl tbody tr:hover td{background:#FAFAFC}.sb-tbl tr.sel td{background:#F0F6FE}
.sb-tbl .num{text-align:right;font-variant-numeric:tabular-nums}
.sb-sort{border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer}
.sb-link{border:0;background:none;padding:0;font:600 13px ${FONT};color:#1D1D1F;cursor:pointer;text-align:left}.sb-link:hover{color:#0071E3}
.sb-link.sm{font-size:12px;font-weight:600;color:#0071E3;white-space:nowrap}.sb-link.r{color:#D70015}
.sb-key{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#6E6E73;margin-left:8px}
.sb-pill{font-size:12px;font-weight:500;padding:2px 8px;border-radius:6px;white-space:nowrap}
.sb-pill.early{background:#FFF4E5;color:#B25000}.sb-pill.mid{background:#EEF4FF;color:#0058B0}.sb-pill.late-stage{background:#E8F6EC;color:#1A7F37}.sb-pill.late{background:#FFECEC;color:#D70015;font-size:11px;margin-left:4px}
.sb-gh{display:flex;align-items:center;gap:10px;width:100%;padding:0 16px;min-height:46px;border:0;border-bottom:1px solid rgba(0,0,0,.06);background:#FBFBFD;font:inherit;color:inherit;cursor:pointer;text-align:left}.sb-gh b{font-size:14px;font-weight:600}
.sb-modal{position:fixed;inset:0;z-index:140;background:rgba(10,15,30,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.sb-dlg{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:16px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.sb-dlg h3{margin:0;font-size:18px;font-weight:600;letter-spacing:-.01em}
.sb-reasons{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 10px}
.sb-reasons button{border:1px solid rgba(0,0,0,.14);border-radius:10px;padding:10px;font:500 13px ${FONT};text-align:left;background:#fff;color:#1D1D1F;cursor:pointer}
.sb-reasons button[aria-pressed=true]{border-color:#0071E3;background:#EEF4FF;color:#0058B0}
.sb-field{display:flex;flex-direction:column;gap:4px;margin-top:10px;font-size:12px;color:#6E6E73}
.sb-next{margin-top:12px;padding:12px;border-radius:10px;background:#F5F6F8}
.sb-toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:150;max-width:min(560px,calc(100vw - 32px));padding:10px 16px;border-radius:12px;background:#1D1D1F;color:#fff;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.3)}
/* deal panel */
.dp{position:fixed;top:12px;right:12px;bottom:12px;width:480px;z-index:96;background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(10,20,40,.35);overflow-y:auto;font-family:${FONT}}
.dp-body{padding:16px 18px 28px;display:flex;flex-direction:column;gap:10px}
.dp-full{left:12px;width:auto;background:#EEF2F7}
.dp-fullwrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:14px;padding:14px;max-width:1500px;margin:0 auto}
.dp-card{background:#fff;border-radius:14px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;align-self:start;box-shadow:0 1px 2px rgba(10,20,40,.06)}
.dp-top{display:flex;align-items:center;gap:6px;padding:12px 16px 0}.dp-body .dp-top,.dp-card .dp-top{padding:0}
.dp-x{border:0;background:none;width:32px;height:32px;border-radius:8px;font-size:15px;color:#6E6E73;cursor:pointer}.dp-x:hover{background:#F2F2F4}
.dp-stages{display:flex;gap:2px;margin:4px 0}
.dp-stages button{flex:1;min-height:30px;border:0;background:#E8EEF8;font:600 11px ${FONT};color:#0058B0;cursor:pointer;clip-path:polygon(0 0,92% 0,100% 50%,92% 100%,0 100%,8% 50%)}
.dp-stages button:first-child{clip-path:polygon(0 0,92% 0,100% 50%,92% 100%,0 100%)}
.dp-stages button.on{background:#0071E3;color:#fff}.dp-stages button:hover{filter:brightness(.95)}
.dp-banner{padding:8px 12px;border-radius:10px;font-size:13px}.dp-banner.won{background:#E8F6EC;color:#1A7F37}.dp-banner.lost{background:#FFECEC;color:#8A1209}.dp-banner.archived{background:#F2F2F4;color:#3A3A3C}
.dp-sec{border-top:1px solid rgba(0,0,0,.08);padding-top:12px}
.dp-sec h4{margin:0 0 8px;font-size:13px;font-weight:600}
.dp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}
.dp-f{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#6E6E73;min-width:0}
.dp-f.wide{grid-column:1/-1}
.dp-f i{font-style:normal;color:#0058B0}.dp-f i.r{color:#D70015}
.dp-f em{font-style:normal;font-size:12px;color:#6E6E73;white-space:nowrap}
.dp-f b{color:#1D1D1F}
.dp-top + .dp-f .sb-in{font-size:20px;font-weight:600;letter-spacing:-.02em;border-color:transparent;padding:0 6px;margin-left:-6px;min-height:40px}
.dp-top + .dp-f .sb-in:hover{border-color:rgba(0,0,0,.12)}
.dp-top + .dp-f > span:first-child{position:absolute;left:-9999px}
.dp-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:#F7F8FA;font-size:13px;margin-bottom:6px}
.dp-add{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}.dp-add .sb-in{width:auto}
.dp-hist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;font-size:13px}
.dp-hist li{display:flex;gap:10px}
.dp-ic{width:24px;height:24px;border-radius:50%;background:#EEF4FF;color:#0058B0;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}
@media (max-width:1199px){.sb-root.panel-open .sb-main{padding-right:28px}}
@media (max-width:899px){.sb-main{padding:14px 16px 64px}.sb-stats{grid-template-columns:1fr 1fr}.sb-cols{grid-template-columns:repeat(6,minmax(250px,82vw))}
 .dp{left:0;right:0;top:0;bottom:0;width:auto;border-radius:0}.dp-fullwrap{grid-template-columns:1fr}.dp-grid{grid-template-columns:1fr}}
`
