// Start gameplay immediately; fonts may finish loading later on mobile networks.
app.startTheGameIfWeCan();
document.fonts.ready.then(function(){ Game.resize(); });
