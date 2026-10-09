// More: settings and administration, kept out of the way of day-to-day work.
import { Activity, Download, HardDrive, HelpCircle, Keyboard, LogOut, Monitor, Palette, ShieldCheck, SlidersHorizontal, Trash2, UserCog, Users, Stethoscope, Info } from "lucide-react";
import { Card, Row } from "../../components/ds.jsx";
import { APP_VERSION } from "../../lib/constants.js";

export function MoreMenu({ cloud, canSettings, isAdmin, onSettings, onTeam, onProfiles, onData, onDataHealth, onHelp, onShortcuts, onInstall, onSignOut, roleLabel, userName, orgName }) {
  return (
    <div className="fm-grid-2">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Card title="Your account" icon={UserCog}>
          <div className="fm-list">
            <Row icon={UserCog} title={userName || "Profile"} sub={[roleLabel, orgName].filter(Boolean).join(" · ")} onClick={onProfiles} />
            {cloud && <Row icon={Users} title="Team & access" sub={isAdmin ? "Invite people, choose their role, manage the company" : "Who's in the team and what they can do"} onClick={onTeam} />}
            {!cloud && <Row icon={ShieldCheck} title="Go live with your team" sub="Connect a company database so everyone signs in and shares the same data" onClick={onTeam} />}
            {cloud && onSignOut && <Row icon={LogOut} title="Sign out" sub="Nothing from your session stays on this device" onClick={onSignOut} />}
          </div>
        </Card>
        <Card title="Set-up" icon={SlidersHorizontal}>
          <div className="fm-list">
            {canSettings && <Row icon={SlidersHorizontal} title="Settings" sub="Categories, custom fields, templates, targets" onClick={onSettings} />}
            <Row icon={Palette} title="Display" sub="Theme, text size, Home cards, notifications" onClick={() => onData("display")} />
            <Row icon={Stethoscope} title="Data health" sub="Services missing a supplier, budget, date or checklist" onClick={onDataHealth} />
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Card title="Records" icon={Activity}>
          <div className="fm-list">
            <Row icon={Activity} title="Activity log" sub="Who did what, and when" onClick={() => onData("activity")} />
            <Row icon={HardDrive} title="Backup & restore" sub="Download everything (with photos) as one file" onClick={() => onData("backup")} />
            <Row icon={Trash2} title="Deleted items" sub="Restore anything deleted in the last 30 days" onClick={() => onData("deleted")} />
          </div>
        </Card>
        <Card title="Help" icon={HelpCircle}>
          <div className="fm-list">
            <Row icon={HelpCircle} title="Help & what's new" onClick={onHelp} />
            <Row icon={Keyboard} title="Keyboard shortcuts" sub="/ search · h home · s maintenance · w works · a notifications" onClick={onShortcuts} />
            {onInstall && <Row icon={Download} title="Install as an app" sub="Home screen or desktop" onClick={onInstall} />}
            <Row icon={Info} title="Version" sub={APP_VERSION} chevron={false} />
            <Row icon={Monitor} title="Works on phone, tablet and desktop" sub="Big buttons and QR scanning on phones; sidebar on wide screens" chevron={false} />
          </div>
        </Card>
      </div>
    </div>
  );
}
