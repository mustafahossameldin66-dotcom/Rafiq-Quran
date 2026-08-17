export const DEFAULT={name:'',age:'',role:'',theme:'dark',graphics:1,locale:'ar',reciter:'Husary_128kbps',volume:.85,notify:false,notifyHour:20,soundEnabled:true,calcMethod:5,asrMethod:0,city:'أسيوط',lat:null,lon:null,goal:604,goalUnit:'صفحة',planMode:'auto',dailyPlan:2,planDays:30,reviewRatio:3,evalMode:'weekly',restDays:[5],streak:0,lastActive:'',firstDate:'',focusMin:0,dailyReviewTarget:3,dailyRepTarget:10,dailyFocusTarget:20,entries:[],dailyLog:{},mistakes:[],prayers:{},dhikr:{},selectedEntryId:null,planStart:'',lastPrayerDate:'',lastDailyBoundary:'',season:'',studyCache:{},ambient:false};

export const state=structuredClone(DEFAULT);

export function replaceState(next) {
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, structuredClone(next));
  return state;
}
