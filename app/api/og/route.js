import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard';

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

export async function GET() {
  const data = await fetch(SCOREBOARD).then(r => r.json());
  const events = (data.events || []).sort((a, b) => a.date.localeCompare(b.date));
  const event =
    events.find(e => e.status.type.state === 'in') ||
    events[0];

  if (!event) {
    return new ImageResponse(
      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#111113' }}>
        <span style={{ color:'rgba(255,255,255,0.4)', fontSize:40, fontWeight:700, letterSpacing:4, textTransform:'uppercase' }}>No games today</span>
      </div>,
      { width: 1200, height: 630 }
    );
  }

  const comp = event.competitions[0];
  const home = comp.competitors.find(c => c.homeAway === 'home');
  const away = comp.competitors.find(c => c.homeAway === 'away');

  const homeAbbr = home.team.abbreviation;
  const awayAbbr = away.team.abbreviation;
  const homeColor = NHL_COLORS[homeAbbr] || '#555';
  const awayColor = NHL_COLORS[awayAbbr] || '#555';
  const homeLogo = `https://a.espncdn.com/i/teamlogos/nhl/500-dark/${homeAbbr.toLowerCase()}.png`;
  const awayLogo = `https://a.espncdn.com/i/teamlogos/nhl/500-dark/${awayAbbr.toLowerCase()}.png`;

  const state = event.status.type.state;
  const isLive = state === 'in';
  const isUpcoming = state === 'pre';

  const homeScore = !isUpcoming ? parseInt(home.score, 10) : null;
  const awayScore = !isUpcoming ? parseInt(away.score, 10) : null;
  const awayWinning = homeScore != null && awayScore > homeScore;
  const homeWinning = homeScore != null && homeScore > awayScore;

  let statusText;
  if (isLive) {
    const p = event.status.period;
    const label = p <= 3 ? ['1st','2nd','3rd'][p - 1] : p === 4 ? 'OT' : `${p - 3}OT`;
    statusText = `${label} · ${event.status.displayClock}`;
  } else if (isUpcoming) {
    const d = new Date(event.date);
    statusText = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  } else {
    const numPeriods = Math.max(home.linescores?.length || 0, away.linescores?.length || 0);
    statusText = numPeriods > 3 ? (numPeriods === 4 ? 'Final / OT' : `Final / ${numPeriods - 3}OT`) : 'Final';
  }

  const dim = 'rgba(255,255,255,0.35)';

  const TeamCol = ({ abbr, logo, score, color, winning }) => (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ width:6, height:120, borderRadius:3, background: winning ? color : 'rgba(255,255,255,0.1)', marginBottom:32 }} />
      <img src={logo} width={148} height={148} style={{ objectFit:'contain' }} />
      <div style={{ marginTop:28, fontSize:54, fontWeight:800, letterSpacing:3, color: winning ? '#fff' : dim, textTransform:'uppercase' }}>{abbr}</div>
      {score != null && (
        <div style={{ marginTop:12, fontSize:100, fontWeight:800, lineHeight:1, color: winning ? '#fff' : dim }}>{score}</div>
      )}
    </div>
  );

  return new ImageResponse(
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#111113', padding:'52px 72px', boxSizing:'border-box' }}>
      <div style={{ display:'flex', alignItems:'center', marginBottom:40 }}>
        <div style={{ fontSize:20, fontWeight:800, letterSpacing:5, color:'rgba(255,255,255,0.25)', textTransform:'uppercase' }}>Scoars</div>
        <div style={{ flex:1 }} />
        {isLive && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(232,70,59,0.15)', border:'1px solid rgba(232,70,59,0.4)', borderRadius:8, padding:'6px 16px' }}>
            <div style={{ width:9, height:9, borderRadius:'50%', background:'#E8463B' }} />
            <span style={{ fontSize:16, fontWeight:800, letterSpacing:3, color:'#E8463B', textTransform:'uppercase' }}>Live</span>
          </div>
        )}
        <div style={{ marginLeft: isLive ? 20 : 0, fontSize:20, fontWeight:700, letterSpacing:2, color: isLive ? '#E8463B' : 'rgba(255,255,255,0.45)', textTransform:'uppercase' }}>{statusText}</div>
      </div>
      <div style={{ flex:1, display:'flex', alignItems:'center' }}>
        <TeamCol abbr={awayAbbr} logo={awayLogo} score={awayScore} color={awayColor} winning={awayWinning} />
        <div style={{ width:2, height:200, background:'rgba(255,255,255,0.07)', margin:'0 48px' }} />
        <TeamCol abbr={homeAbbr} logo={homeLogo} score={homeScore} color={homeColor} winning={homeWinning} />
      </div>
      <div style={{ marginTop:32, fontSize:16, fontWeight:500, letterSpacing:2, color:'rgba(255,255,255,0.2)', textAlign:'center', textTransform:'uppercase' }}>
        {comp.venue?.fullName || ''}
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
