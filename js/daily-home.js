(function(){
  const originalDaily=window.renderDailyHome;
  window.renderDailyHome=function(){ if(typeof originalDaily==='function') originalDaily(); try{window.applyStableDailyContent?.()}catch{} };
})();
