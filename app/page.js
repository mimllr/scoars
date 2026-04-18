'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ─── NHL Team Colors ─────────────────────────────────────────
const NHL_COLORS = {
  ANA:'#F47A38', ARI:'#8C2633', UTA:'#69B3E7', BOS:'#FFB81C',
  BUF:'#003087', CGY:'#C8102E', CAR:'#CC0000', CHI:'#CF0A2C',
  COL:'#6F263D', CBJ:'#002654', DAL:'#006847', DET:'#CE1126',
  EDM:'#FF4C00', FLA:'#041E42', LAK:'#A2AAAD', MIN:'#154734',
  MTL:'#AF1E2D', NSH:'#FFB81C', NJD:'#CE1126', NYI:'#003087',
  NYR:'#0038A8', OTT:'#C2912C', PHI:'#F74902', PIT:'#FCB514',
  STL:'#002F87', SJS:'#006D75', SEA:'#001628', TBL:'#002868',
  TOR:'#003E7E', VAN:'#00205B', VGK:'#B4975A', WSH:'#C8102E',
  WPG:'#041E42',
};

// ─── ESPN Data Transforms ─────────────────────────────────────
function buildTeamsMap(events) {
  const map = {};
  events.forEach(event => {
    event.competitions?.[0]?.competitors?.forEach(c => {
      const { abbreviation, displayName, shortDisplayName, logos } = c.team;
      const abbr = abbreviation.toLowerCase();
      const darkLogo  = logos?.find(l => l.rel?.includes('dark'))?.href
                     || `https://a.espncdn.com/i/teamlogos/nhl/500-dark/${abbr}.png`;
      const lightLogo = logos?.find(l => l.rel?.includes('default') || !l.rel?.includes('dark'))?.href
                     || `https://a.espncdn.com/i/teamlogos/nhl/500/${abbr}.png`;
      map[abbreviation] = {
        code: abbreviation,
        name: shortDisplayName || displayName.split(' ').pop(),
        color: NHL_COLORS[abbreviation] || '#666',
        logoDark: darkLogo,
        logoLight: lightLogo,
      };
    });
  });
  return map;
}

function transformEvents(events) {
  return events.map(event => {
    const comp = event.competitions?.[0];
    if (!comp) return null;
    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) return null;

    const espnState = event.status.type.state;
    const status = espnState === 'pre' ? 'upcoming' : espnState === 'in' ? 'live' : 'final';

    const homeLs = homeComp.linescores || [];
    const awayLs = awayComp.linescores || [];
    const numPeriods = Math.max(homeLs.length, awayLs.length);
    const periodScores = Array.from({ length: numPeriods }, (_, i) => ({
      home: homeLs[i]?.value ?? 0,
      away: awayLs[i]?.value ?? 0,
    }));

    let stateDisplay;
    if (status === 'live') {
      const p = event.status.period;
      const label = p <= 3 ? ['1st','2nd','3rd'][p-1] : p === 4 ? 'OT' : `${p-3}OT`;
      stateDisplay = `${label} · ${event.status.displayClock}`;
    } else if (status === 'upcoming') {
      const d = new Date(event.date);
      stateDisplay = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      stateDisplay = numPeriods > 3 ? (numPeriods === 4 ? 'Final/OT' : `Final/${numPeriods-3}OT`) : 'Final';
    }

    return {
      id: event.id,
      status,
      startTime: event.date,
      away: awayComp.team.abbreviation,
      home: homeComp.team.abbreviation,
      awayScore: status !== 'upcoming' ? parseInt(awayComp.score, 10) : null,
      homeScore: status !== 'upcoming' ? parseInt(homeComp.score, 10) : null,
      periodScores,
      state: stateDisplay,
      venue: comp.venue?.fullName || '',
      goals: [],
    };
  }).filter(Boolean);
}

function strengthCode(text = '') {
  if (/power/i.test(text)) return 'PP';
  if (/short/i.test(text)) return 'SH';
  if (/penalty/i.test(text)) return 'PS';
  return 'EV';
}

function transformSummaryGoals(data) {
  const teamIdMap = {};
  (data?.boxscore?.teams || []).forEach(t => {
    if (t.team?.id) teamIdMap[t.team.id] = t.team.abbreviation || '';
  });

  const goals = [];
  (data?.plays || []).forEach(play => {
    if (!play.scoringPlay) return;
    if (!/goal/i.test(play.type?.text || '')) return;
    const scorer = (play.participants || []).find(p => p.type === 'scorer');
    const assists = (play.participants || [])
      .filter(p => p.type === 'assister')
      .map(a => a.athlete?.shortName || a.athlete?.displayName || '?');
    goals.push({
      period: play.period?.number ?? 0,
      periodDisplay: play.period?.displayValue || `Period ${play.period?.number ?? '?'}`,
      time: play.clock?.displayValue || '0:00',
      team: teamIdMap[play.team?.id] || '',
      scorer: scorer?.athlete?.shortName || scorer?.athlete?.displayName || '?',
      assists,
      strength: strengthCode(play.strength?.text),
    });
  });
  return goals;
}

// ─── Teams Context ────────────────────────────────────────────
const TeamsCtx = createContext({});

// ─── iOS Frame ────────────────────────────────────────────────
function IOSGlassPill({ children, dark = false, style = {} }) {
  return (
    <div style={{ height:44, minWidth:44, borderRadius:9999, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)', ...style }}>
      <div style={{ position:'absolute', inset:0, borderRadius:9999, backdropFilter:'blur(12px) saturate(180%)', WebkitBackdropFilter:'blur(12px) saturate(180%)', background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)' }} />
      <div style={{ position:'absolute', inset:0, borderRadius:9999, boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)', border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)' }} />
      <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'center', padding:'0 4px' }}>{children}</div>
    </div>
  );
}

function IOSNavBar({ title = 'Title', dark = false }) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pill = content => (
    <IOSGlassPill dark={dark}>
      <div style={{ width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>{content}</div>
    </IOSGlassPill>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, paddingTop:16, paddingBottom:10, position:'relative', zIndex:5 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px' }}>
        {pill(<svg width="12" height="20" viewBox="0 0 12 20" fill="none" style={{ marginLeft:-1 }}><path d="M10 2L2 10l8 8" stroke={muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>)}
        {pill(<svg width="22" height="6" viewBox="0 0 22 6"><circle cx="3" cy="3" r="2.5" fill={muted}/><circle cx="11" cy="3" r="2.5" fill={muted}/><circle cx="19" cy="3" r="2.5" fill={muted}/></svg>)}
      </div>
      <div style={{ padding:'0 16px', fontFamily:'-apple-system,system-ui', fontSize:34, fontWeight:700, lineHeight:'41px', color:text, letterSpacing:0.4 }}>{title}</div>
    </div>
  );
}

function IOSDevice({ children, width = 402, height = 874, dark = false, title }) {
  return (
    <div style={{ width, height, borderRadius:48, overflow:'hidden', position:'relative', background: dark ? '#000' : '#F2F2F7', boxShadow:'0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)', fontFamily:'-apple-system,system-ui,sans-serif', WebkitFontSmoothing:'antialiased' }}>
      <div style={{ position:'absolute', top:11, left:'50%', transform:'translateX(-50%)', width:126, height:37, borderRadius:24, background:'#000', zIndex:50 }} />
      <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>
        {title !== undefined && <IOSNavBar title={title} dark={dark} />}
        <div style={{ flex:1, overflow:'auto' }}>{children}</div>
      </div>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:60, height:34, display:'flex', justifyContent:'center', alignItems:'flex-end', paddingBottom:8, pointerEvents:'none' }}>
        <div style={{ width:139, height:5, borderRadius:100, background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)' }} />
      </div>
    </div>
  );
}

// ─── Scoreboard Components ────────────────────────────────────
function TeamSwatch({ teamCode, size = 28, dark = false }) {
  const teams = useContext(TeamsCtx);
  const team = teams[teamCode];
  if (!team) return <div style={{ width:size, height:size, borderRadius:7, background:'#333', flexShrink:0 }} />;
  const logo = dark ? team.logoDark : team.logoLight;
  const pad = Math.round(size * 0.12);
  return (
    <div style={{ width:size, height:size, borderRadius:7, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border:`1px solid ${team.color}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>
      <img src={logo} alt={team.code} style={{ width:size - pad*2, height:size - pad*2, objectFit:'contain', display:'block' }} />
    </div>
  );
}

function LivePill({ dark }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 9px 4px 7px', borderRadius:6, background: dark ? 'rgba(232,70,59,0.14)' : 'rgba(232,70,59,0.1)', border:`1px solid ${dark ? 'rgba(232,70,59,0.35)' : 'rgba(232,70,59,0.25)'}` }}>
      <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:'#E8463B', boxShadow:'0 0 0 0 rgba(232,70,59,0.5)' }} />
      <span style={{ fontSize:10, fontWeight:800, letterSpacing:1, color:'#E8463B', fontFamily:'Oswald,Impact,sans-serif' }}>LIVE</span>
    </div>
  );
}

function GameRow({ game, onClick, dark }) {
  const teams = useContext(TeamsCtx);
  const away = teams[game.away] || { code: game.away, name: '', color: '#666' };
  const home = teams[game.home] || { code: game.home, name: '', color: '#666' };
  const isLive = game.status === 'live';
  const isFinal = game.status === 'final';
  const isUpcoming = game.status === 'upcoming';

  const text = dark ? '#fff' : '#0a0a0a';
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';
  const dim = dark ? 'rgba(235,235,245,0.35)' : 'rgba(60,60,67,0.35)';
  const rowBg = dark ? '#171719' : '#fff';
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const awayWinning = !isUpcoming && game.awayScore > game.homeScore;
  const homeWinning = !isUpcoming && game.homeScore > game.awayScore;

  const scoreStyle = winning => ({ fontFamily:'Oswald,Impact,sans-serif', fontSize:30, fontWeight:600, letterSpacing:0.5, lineHeight:1, color: isUpcoming ? dim : (winning ? text : muted), fontVariantNumeric:'tabular-nums', minWidth:28, textAlign:'right' });
  const nameStyle = winning => ({ fontFamily:'Oswald,Impact,sans-serif', fontSize:15, fontWeight:500, letterSpacing:0.6, color: isUpcoming ? muted : (winning ? text : muted), textTransform:'uppercase' });

  return (
    <button onClick={() => onClick(game)} style={{ all:'unset', cursor:'pointer', display:'block', width:'100%', boxSizing:'border-box', background:rowBg, borderRadius:14, padding:'14px 14px', border:`1px solid ${border}`, position:'relative', transition:'transform 0.15s ease', WebkitTapHighlightColor:'transparent' }}
      onTouchStart={e => e.currentTarget.style.transform='scale(0.985)'}
      onTouchEnd={e => e.currentTarget.style.transform='scale(1)'}
      onMouseDown={e => e.currentTarget.style.transform='scale(0.985)'}
      onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        {isLive && <LivePill dark={dark} />}
        {isFinal && <span style={{ fontSize:10, fontWeight:800, letterSpacing:1, color:muted, fontFamily:'Oswald,Impact,sans-serif' }}>FINAL</span>}
        {isUpcoming && <span style={{ fontSize:10, fontWeight:800, letterSpacing:1, color:muted, fontFamily:'Oswald,Impact,sans-serif' }}>SCHEDULED</span>}
        <span style={{ fontSize:11, fontWeight:500, color:muted, fontFamily:'Oswald,Impact,sans-serif', letterSpacing:0.6, fontVariantNumeric:'tabular-nums' }}>
          {isLive ? game.state : isUpcoming ? game.state : game.venue}
        </span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <TeamSwatch teamCode={game.away} dark={dark} />
          <div style={{ flex:1, ...nameStyle(awayWinning) }}>{away.code} <span style={{ opacity:0.6, fontWeight:400, marginLeft:4 }}>{away.name}</span></div>
          {!isUpcoming && <div style={scoreStyle(awayWinning)}>{game.awayScore}</div>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <TeamSwatch teamCode={game.home} dark={dark} />
          <div style={{ flex:1, ...nameStyle(homeWinning) }}>{home.code} <span style={{ opacity:0.6, fontWeight:400, marginLeft:4 }}>{home.name}</span></div>
          {!isUpcoming && <div style={scoreStyle(homeWinning)}>{game.homeScore}</div>}
        </div>
      </div>
      {isUpcoming && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px dashed ${border}`, fontSize:11, color:muted, fontFamily:'Oswald,Impact,sans-serif', letterSpacing:0.6, textAlign:'center', textTransform:'uppercase' }}>
          Puck drop · {game.state}
        </div>
      )}
    </button>
  );
}

function Scoreboard({ games, onOpenGame, dark }) {
  const sorted = [...games].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const liveCount = sorted.filter(g => g.status === 'live').length;
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  return (
    <div style={{ padding:'0 14px 120px', display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 4px 14px' }}>
        <div style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:12, fontWeight:500, letterSpacing:1.2, color:muted, textTransform:'uppercase' }}>{dateStr}</div>
        {liveCount > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontFamily:'Oswald,Impact,sans-serif', fontSize:11, fontWeight:600, letterSpacing:1, color:'#E8463B', textTransform:'uppercase' }}>
            <span className="live-dot" style={{ width:6, height:6, borderRadius:'50%', background:'#E8463B' }} />
            {liveCount} Live
          </div>
        )}
      </div>
      {sorted.map(game => <GameRow key={game.id} game={game} onClick={onOpenGame} dark={dark} />)}
    </div>
  );
}

// ─── Detail Sheet ─────────────────────────────────────────────
function SectionHeader({ title, dark }) {
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';
  return <div style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:11, fontWeight:600, letterSpacing:1.3, color:muted, textTransform:'uppercase', padding:'6px 4px 10px' }}>{title}</div>;
}

function DetailHeader({ game, dark }) {
  const teams = useContext(TeamsCtx);
  const isUpcoming = game.status === 'upcoming';
  const awayWinning = !isUpcoming && game.awayScore > game.homeScore;
  const homeWinning = !isUpcoming && game.homeScore > game.awayScore;
  const text = dark ? '#fff' : '#0a0a0a';
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';
  const dim = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';

  const TeamBlock = ({ code, score, winning }) => {
    const team = teams[code] || { code, name: '', color: '#666', logoDark: '', logoLight: '' };
    const logo = dark ? team.logoDark : team.logoLight;
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
        <div style={{ width:72, height:72, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <img src={logo} alt={team.code} style={{ width:68, height:68, objectFit:'contain', display:'block' }} />
        </div>
        <div style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:13, fontWeight:500, letterSpacing:1.2, color:muted, textTransform:'uppercase' }}>{team.name}</div>
        {!isUpcoming && <div style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:64, fontWeight:600, lineHeight:1, color: winning ? text : muted, fontVariantNumeric:'tabular-nums' }}>{score}</div>}
      </div>
    );
  };

  return (
    <div style={{ padding:'6px 20px 24px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:18 }}>
        {game.status === 'live' && <LivePill dark={dark} />}
        <span style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:12, fontWeight:600, letterSpacing:1.4, color: game.status === 'live' ? '#E8463B' : muted, textTransform:'uppercase' }}>
          {game.status === 'live' ? game.state : game.status === 'final' ? game.state : `Puck drop · ${game.state}`}
        </span>
      </div>
      <div style={{ display:'flex', alignItems: isUpcoming ? 'center' : 'flex-end', gap:14 }}>
        <TeamBlock code={game.away} score={game.awayScore} winning={awayWinning} />
        {!isUpcoming && <div style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:16, fontWeight:500, color:dim, paddingBottom:18 }}>@</div>}
        <TeamBlock code={game.home} score={game.homeScore} winning={homeWinning} />
      </div>
      <div style={{ marginTop:18, textAlign:'center', fontFamily:'Oswald,Impact,sans-serif', fontSize:11, fontWeight:400, letterSpacing:1.1, color:dim, textTransform:'uppercase' }}>{game.venue}</div>
    </div>
  );
}

function PeriodScoring({ game, dark }) {
  if (game.status === 'upcoming') return null;
  const teams = useContext(TeamsCtx);
  const text = dark ? '#fff' : '#0a0a0a';
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';
  const dim = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const cardBg = dark ? '#171719' : '#fff';

  const cols = Array.from({ length: 3 }, (_, i) => game.periodScores[i] || null);

  const Cell = ({ children, bold, highlight }) => (
    <div style={{ flex:1, textAlign:'center', fontFamily:'Oswald,Impact,sans-serif', fontSize: bold ? 22 : 18, fontWeight: bold ? 600 : 500, fontVariantNumeric:'tabular-nums', color: highlight ? text : (bold ? text : muted), lineHeight:1 }}>{children}</div>
  );
  const HeaderCell = ({ children, bold }) => (
    <div style={{ flex:1, textAlign:'center', fontFamily:'Oswald,Impact,sans-serif', fontSize:10, fontWeight:600, letterSpacing:1.2, color: bold ? text : dim, textTransform:'uppercase' }}>{children}</div>
  );
  const TeamLabel = ({ code }) => {
    const t = teams[code] || { code, color: '#666', logoDark: '', logoLight: '' };
    const logo = dark ? t.logoDark : t.logoLight;
    return (
      <div style={{ width:92, display:'flex', alignItems:'center', gap:8 }}>
        <img src={logo} alt={t.code} style={{ width:20, height:20, objectFit:'contain', flexShrink:0 }} />
        <span style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:13, fontWeight:600, letterSpacing:0.6, color:text }}>{t.code}</span>
      </div>
    );
  };

  const hasOT = game.periodScores.length > 3;

  return (
    <div style={{ padding:'0 16px 20px' }}>
      <SectionHeader title="Scoring by period" dark={dark} />
      <div style={{ background:cardBg, borderRadius:14, border:`1px solid ${border}`, padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', paddingBottom:10, borderBottom:`1px solid ${border}` }}>
          <div style={{ width:92 }} />
          <HeaderCell>1st</HeaderCell><HeaderCell>2nd</HeaderCell><HeaderCell>3rd</HeaderCell>
          {hasOT && <HeaderCell>OT</HeaderCell>}
          <HeaderCell bold>T</HeaderCell>
        </div>
        {[game.away, game.home].map((code, ri) => {
          const isAway = ri === 0;
          return (
            <div key={code} style={{ display:'flex', alignItems:'center', padding:'12px 0', borderBottom: ri === 0 ? `1px solid ${border}` : 'none' }}>
              <TeamLabel code={code} />
              {cols.map((c, i) => <Cell key={i}>{c ? (isAway ? c.away : c.home) : '—'}</Cell>)}
              {hasOT && <Cell>{game.periodScores[3] ? (isAway ? game.periodScores[3].away : game.periodScores[3].home) : '—'}</Cell>}
              <Cell bold highlight>{isAway ? game.awayScore : game.homeScore}</Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTimeline({ game, dark, loading }) {
  const teams = useContext(TeamsCtx);
  const text = dark ? '#fff' : '#0a0a0a';
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';
  const dim = dark ? 'rgba(235,235,245,0.35)' : 'rgba(60,60,67,0.35)';
  const border = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const cardBg = dark ? '#171719' : '#fff';

  if (game.status === 'upcoming') {
    return (
      <div style={{ padding:'0 16px 40px' }}>
        <SectionHeader title="Goals" dark={dark} />
        <div style={{ padding:'32px 16px', textAlign:'center', background:cardBg, border:`1px solid ${border}`, borderRadius:14, fontFamily:'Oswald,Impact,sans-serif', fontSize:13, letterSpacing:1, color: dark ? 'rgba(235,235,245,0.4)' : 'rgba(60,60,67,0.4)', textTransform:'uppercase' }}>Game hasn't started yet</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding:'0 16px 40px' }}>
        <SectionHeader title="Goals" dark={dark} />
        <div style={{ padding:'32px 16px', textAlign:'center', background:cardBg, border:`1px solid ${border}`, borderRadius:14, fontFamily:'Oswald,Impact,sans-serif', fontSize:13, letterSpacing:1, color:dim, textTransform:'uppercase' }}>Loading…</div>
      </div>
    );
  }

  if (game.goals.length === 0) {
    return (
      <div style={{ padding:'0 16px 40px' }}>
        <SectionHeader title="Goals" dark={dark} />
        <div style={{ padding:'32px 16px', textAlign:'center', background:cardBg, border:`1px solid ${border}`, borderRadius:14, fontFamily:'Oswald,Impact,sans-serif', fontSize:13, letterSpacing:1, color:dim, textTransform:'uppercase' }}>Scoreless so far</div>
      </div>
    );
  }

  const byPeriod = {};
  const periodLabels = {};
  game.goals.forEach(g => {
    if (!byPeriod[g.period]) byPeriod[g.period] = [];
    byPeriod[g.period].push(g);
    periodLabels[g.period] = g.periodDisplay;
  });

  return (
    <div style={{ padding:'0 16px 40px' }}>
      <SectionHeader title="Goals" dark={dark} />
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {Object.keys(byPeriod).sort((a,b) => +a - +b).map(period => (
          <div key={period}>
            <div style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:10, fontWeight:600, letterSpacing:1.4, color:dim, textTransform:'uppercase', padding:'0 4px 8px' }}>{periodLabels[+period]}</div>
            <div style={{ background:cardBg, borderRadius:14, border:`1px solid ${border}`, overflow:'hidden' }}>
              {byPeriod[period].map((goal, i) => {
                const team = teams[goal.team] || { color:'#666', code: goal.team };
                const isLast = i === byPeriod[period].length - 1;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderBottom: isLast ? 'none' : `1px solid ${border}` }}>
                    <div style={{ width:44, flexShrink:0, fontFamily:'Oswald,Impact,sans-serif', fontSize:14, fontWeight:500, letterSpacing:0.4, color:muted, fontVariantNumeric:'tabular-nums' }}>{goal.time}</div>
                    <div style={{ width:4, alignSelf:'stretch', borderRadius:2, background:team.color }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'-apple-system,system-ui', fontSize:15, fontWeight:600, color:text, display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                        <span style={{ fontFamily:'Oswald,Impact,sans-serif', fontSize:11, fontWeight:600, letterSpacing:1, color:team.color, textTransform:'uppercase' }}>{team.code}</span>
                        <span style={{ color:dim, fontWeight:400 }}>·</span>
                        <span>{goal.scorer}</span>
                        {goal.strength !== 'EV' && <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.8, padding:'2px 5px', borderRadius:3, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color:muted, fontFamily:'Oswald,Impact,sans-serif' }}>{goal.strength}</span>}
                      </div>
                      {goal.assists.length > 0
                        ? <div style={{ fontFamily:'-apple-system,system-ui', fontSize:12, color:muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Assists: {goal.assists.join(', ')}</div>
                        : <div style={{ fontFamily:'-apple-system,system-ui', fontSize:12, color:dim }}>Unassisted</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSheet({ game, onClose, dark, positioning = 'absolute', goalsLoading }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (game) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [game]);

  const doClose = () => {
    setMounted(false);
    setTimeout(() => onClose(), 280);
  };

  if (!game) return null;

  const sheetBg = dark ? '#0D0D0F' : '#F2F2F7';
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';

  return (
    <>
      <div onClick={doClose} style={{ position:positioning, inset:0, zIndex:100, background:'rgba(0,0,0,0.5)', opacity: mounted ? 1 : 0, transition:'opacity 0.28s ease' }} />
      <div style={{ position:positioning, left:0, right:0, bottom:0, zIndex:101, height:'92%', background:sheetBg, borderTopLeftRadius:28, borderTopRightRadius:28, transform: mounted ? 'translateY(0)' : 'translateY(100%)', transition:'transform 0.32s cubic-bezier(0.22,0.61,0.36,1)', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 -20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ padding:'10px 16px 6px', display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, position:'relative' }}>
          <div style={{ width:40, height:5, borderRadius:3, background: dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)' }} />
          <button onClick={doClose} style={{ all:'unset', cursor:'pointer', position:'absolute', top:14, right:18, width:30, height:30, borderRadius:15, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke={muted} strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div style={{ flex:1, overflow:'auto', paddingBottom:40 }}>
          <DetailHeader game={game} dark={dark} />
          <PeriodScoring game={game} dark={dark} />
          <GoalsTimeline game={game} dark={dark} loading={goalsLoading} />
        </div>
      </div>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────
const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard';
const summaryURL = id => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${id}`;

export default function App() {
  const [dark, setDark] = useState(true);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openGame, setOpenGame] = useState(null);
  const [summaryCache, setSummaryCache] = useState({});
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 500);
  }, []);

  const fetchScoreboard = useCallback(async () => {
    try {
      const res = await fetch(SCOREBOARD_URL);
      if (!res.ok) throw new Error(`ESPN returned ${res.status}`);
      const data = await res.json();
      const events = data.events || [];
      setTeams(buildTeamsMap(events));
      setGames(transformEvents(events));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScoreboard();
    const id = setInterval(fetchScoreboard, 30000);
    return () => clearInterval(id);
  }, [fetchScoreboard]);

  const handleOpenGame = useCallback(async (game) => {
    setOpenGame(game);
    if (summaryCache[game.id] !== undefined) return;
    if (game.status === 'upcoming') return;
    setGoalsLoading(true);
    try {
      const res = await fetch(summaryURL(game.id));
      const data = await res.json();
      setSummaryCache(prev => ({ ...prev, [game.id]: transformSummaryGoals(data) }));
    } catch (_) {
      setSummaryCache(prev => ({ ...prev, [game.id]: [] }));
    } finally {
      setGoalsLoading(false);
    }
  }, [summaryCache]);

  const gameWithGoals = useMemo(() => {
    if (!openGame) return null;
    const cached = summaryCache[openGame.id];
    return { ...openGame, goals: cached ?? openGame.goals };
  }, [openGame, summaryCache]);

  const bg = dark ? '#0a0a0a' : '#F2F2F7';
  const muted = dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)';

  const emptyState = (
    <div style={{ padding:'80px 20px', textAlign:'center' }}>
      {loading
        ? <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, letterSpacing:1, color:muted, textTransform:'uppercase' }}>Loading scores…</span>
        : error
          ? <div style={{ fontFamily:'Oswald,sans-serif', fontSize:13, letterSpacing:1, color:'#E8463B', textTransform:'uppercase' }}>
              Couldn't load scores.<br/>
              <button onClick={fetchScoreboard} style={{ all:'unset', cursor:'pointer', marginTop:12, color:muted, fontFamily:'Oswald,sans-serif', fontSize:12, letterSpacing:1, textTransform:'uppercase' }}>Try again</button>
            </div>
          : <span style={{ fontFamily:'Oswald,sans-serif', fontSize:13, letterSpacing:1, color:muted, textTransform:'uppercase' }}>No games today</span>}
    </div>
  );

  const darkToggle = (
    <button onClick={() => setDark(d => !d)} style={{ all:'unset', cursor:'pointer', position:'fixed', right:16, bottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom, 0px))' : 16, zIndex:9999, background:'#18181b', color:'rgba(255,255,255,0.7)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'50%', width:40, height:40, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>
      {dark ? '☀️' : '🌙'}
    </button>
  );

  if (isMobile) {
    return (
      <TeamsCtx.Provider value={teams}>
        <div style={{ width:'100vw', minHeight:'100vh', background:bg, paddingTop:'env(safe-area-inset-top, 20px)', position:'relative' }}>
          <div style={{ padding:'12px 14px 4px', fontFamily:'-apple-system,system-ui', fontSize:28, fontWeight:700, color: dark ? '#fff' : '#000' }}>Scoars</div>
          {games.length === 0 ? emptyState : <Scoreboard games={games} onOpenGame={handleOpenGame} dark={dark} />}
          <DetailSheet game={gameWithGoals} onClose={() => setOpenGame(null)} dark={dark} positioning="fixed" goalsLoading={goalsLoading} />
          {darkToggle}
        </div>
      </TeamsCtx.Provider>
    );
  }

  return (
    <TeamsCtx.Provider value={teams}>
      <div style={{ position:'relative' }}>
        <IOSDevice dark={dark} width={402} height={874} title="Scores">
          <div style={{ minHeight:'100%', background:bg, position:'relative' }}>
            {games.length === 0 ? emptyState : <Scoreboard games={games} onOpenGame={handleOpenGame} dark={dark} />}
            <DetailSheet game={gameWithGoals} onClose={() => setOpenGame(null)} dark={dark} positioning="absolute" goalsLoading={goalsLoading} />
          </div>
        </IOSDevice>
      </div>
      {darkToggle}
    </TeamsCtx.Provider>
  );
}
