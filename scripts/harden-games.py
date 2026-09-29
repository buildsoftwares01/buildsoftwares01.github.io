from pathlib import Path
import re
root = Path('public/games')
bootstrap = '''// Invitation adaptation: scores live only in this isolated game session.
(() => {
 const values = Object.create(null);
 const storage = {getItem:k=>Object.hasOwn(values,k)?values[k]:null,setItem:(k,v)=>{values[k]=String(v)},removeItem:k=>{delete values[k]},clear:()=>{for(const k of Object.keys(values))delete values[k]}};
 Object.defineProperty(window, 'localStorage', {value:storage});
 Object.defineProperty(document, 'cookie', {get:()=>'',set:()=>{},configurable:true});
})();
'''
(root/'session.js').write_text(bootstrap)
policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; worker-src blob:; base-uri 'none'; form-action 'none'; object-src 'none'"
for name in ['2048','hextris','ohhi']:
 p = root/name/'index.html'
 s = p.read_text()
 s = re.sub(r'<script\b[^>]*src=[\"\']https?[^>]*>.*?</script>', '', s, flags=re.S)
 s = re.sub(r'<link\b[^>]*href=[\"\']https?[^>]*>', '', s)
 if name == 'hextris':
  s = re.sub(r'<script\b(?![^>]*\bsrc=)[^>]*>.*?</script>', '', s, flags=re.S)
  s = re.sub(r'\s+onclick="[^"]*"', '', s)
  s = s.replace('<script type="text/javascript" src=\'vendor/rrssb.min.js\'></script>', '')
  s = s.replace('</head>', '<link rel="stylesheet" href="invitation.css"></head>')
  (root/name/'invitation.css').write_text('#socialShare,#buttonCont{display:none!important}body{font-family:Arial,sans-serif}')
 if name == 'ohhi':
  s = re.sub(r'<script\b(?![^>]*\bsrc=)[^>]*>.*?</script>', '', s, flags=re.S)
  files = ['jquery-2.1.0.min','utils','state','game','grid','tile','hint','tutorial','levels','backgroundservice']
  s = s.replace('</body>', ''.join('<script src="js/'+x+'.js"></script>' for x in files)+'<script src="invitation-start.js"></script></body>')
  (root/name/'invitation-start.js').write_text("document.fonts.ready.then(function(){ app.startTheGameIfWeCan(); });")
  (root/name/'config.js').write_text('var Config = {debug:false,tweet:false,barph:false};')
 if name == '2048':
  s = re.sub(r'<hr>\s*<p>\s*<strong class="important">Note:.*?</p>', '', s, flags=re.S)
  s = s.replace('Use your <strong>arrow keys</strong>', '<strong>Swipe</strong> or use your <strong>arrow keys</strong>')
 s = s.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="'+policy+'"><script src="../session.js"></script>')
 # Hextris has whitespace, but the literal head is the same.
 p.write_text(s)
p = root/'hextris/js/main.js'
s = p.read_text()
s = re.sub(r"\s*\$\.get\('http://54\.183\.184\.126/' \+ String\(score\)\)", '', s)
s = re.sub(r"\(function\(\)\{\s*var script = document.createElement\('script'\);.*?\}\)\(\)", '', s, flags=re.S)
p.write_text(s)
p = root/'hextris/js/initialization.js'
s = p.read_text()
s = re.sub(r"\(function\(i, s, o, g, r, a, m\) \{.*?ga\('send', 'pageview'\);", '', s, flags=re.S)
p.write_text(s)
# This integration never restores saved functions; use data-only JSON serialization.
(root/'hextris/vendor/jsonfn.min.js').write_text('window.JSONfn={stringify:JSON.stringify,parse:JSON.parse,clone:function(value){return JSON.parse(JSON.stringify(value));}};')
# Disable legacy external telemetry loader, not needed by the game.
(root/'hextris/a.js').write_text('// External advertising loader removed in invitation distribution.\n')
