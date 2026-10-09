// People → On site & visitors, and Team & contacts.
import { Mail, Phone, Users, UserCog, Pencil } from "lucide-react";
import { ExpectedVisitors, SiteRegister, EmergencyContacts } from "../../tabs/HomeTab.jsx";
import { OnCallCard, PeopleDirectoryModal } from "../../tabs/MoreViews.jsx";
import { Btn, Card, InlineModalContext, Pill } from "../../components/ds.jsx";
import { ROLES, normaliseRole } from "../../app/permissions.js";

export function OnSiteView({ register, expected }) {
  return (
    <div className="fm-grid-2">
      <div style={{ minWidth: 0 }}><SiteRegister {...register} /></div>
      <div style={{ minWidth: 0 }}><Card title="Expected visitors & contractors" icon={Users}><ExpectedVisitors {...expected} /></Card></div>
    </div>
  );
}

export function TeamView({ users = [], cloudRole, myLoginId, locations = [], siteId, onCall = [], onSaveOnCall, emergency, onSaveEmergency, suppliers = [], onEditSite, onTeamAccess, canEdit, cloud }) {
  const site = locations.find((l) => l.id === siteId);
  return (
    <div className="fm-grid-2">
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <Card title="Team profiles" icon={UserCog} right={onTeamAccess ? <Btn size="sm" variant="ghost" onClick={onTeamAccess}>{cloud ? "Team & access" : "Profiles"}</Btn> : null}>
          <div className="fm-list">
            {users.filter((u) => !u.sites?.length || u.sites.includes(siteId)).map((u) => (
              <div key={u.id} className="fm-row">
                <span className="fm-row-main"><span className="fm-row-title">{u.name}{u.loginId && u.loginId === myLoginId ? " (you)" : ""}</span><span className="fm-row-sub">{[u.jobTitle, u.email, u.loginEmail && u.loginEmail !== u.email ? u.loginEmail : ""].filter(Boolean).join(" · ") || "—"}</span></span>
                {!cloud && <Pill tone="muted">{ROLES[normaliseRole(u.role)]?.short}</Pill>}
                {cloud && u.loginId && <Pill tone="info">Signs in</Pill>}
                {u.phone && <a href={`tel:${u.phone.replace(/[^+0-9]/g, "")}`} aria-label={`Call ${u.name}`} style={{ color: "var(--ok)" }}><Phone size={16} /></a>}
                {u.email && <a href={`mailto:${u.email}`} aria-label={`Email ${u.name}`} style={{ color: "var(--accent)" }}><Mail size={16} /></a>}
              </div>
            ))}
          </div>
          {cloud && <div className="fm-sub">What each person can do is set by their role{cloudRole ? ` (yours: ${ROLES[normaliseRole(cloudRole)]?.label})` : ""} under More → Team & access.</div>}
        </Card>
        <InlineModalContext.Provider value={true}><PeopleDirectoryModal locations={locations} onClose={() => {}} /></InlineModalContext.Provider>
        {canEdit && onEditSite && <div><Btn size="sm" icon={Pencil} onClick={onEditSite}>Edit {site?.name || "site"} people</Btn></div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <OnCallCard rota={onCall} onSave={onSaveOnCall} />
        <EmergencyContacts suppliers={suppliers} contacts={emergency} onSave={onSaveEmergency} />
      </div>
    </div>
  );
}
