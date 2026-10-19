/** Pure, offline-only schedule arithmetic. Reminder notifications are opt-in and app-open only. */
import {suggestedMinimumSeconds,candleAudit} from './free-collector-core.mjs';
export const SCHEDULE_SLOTS=[0,8,16];
export function nextDue(lastMs,tf,nowMs=Date.now()){
 const last=Number(lastMs),minimum=suggestedMinimumSeconds(tf)*1000;
 if(!Number.isFinite(last)||last<=0)return nowMs;
 return last+minimum;
}
export function nextDailyWindow(nowMs,slots=SCHEDULE_SLOTS){
 const now=new Date(nowMs); const times=[];
 for(let d=0;d<=2;d++)for(const h of slots){
  const t=new Date(now);t.setHours(h,0,0,0);t.setDate(now.getDate()+d);
  if(t.getTime()>=nowMs)times.push(t.getTime());
 }
 return Math.min(...times);
}
export function nextRecommended(lastMs,tf,nowMs=Date.now()){
 const last=Number(lastMs);
 if(!Number.isFinite(last)||last<=0)return nowMs;
 const due=nextDue(last,tf,nowMs);
 // Fix deadline against the last actual collection, NOT the current clock.
 // Otherwise the suggested slot moves forward forever after it becomes overdue.
 return tf===30?nextDailyWindow(due):due;
}
export function archiveHealth(candles,tf,nowSec=Date.now()/1000){
 const a=candleAudit(candles,tf);
 return {...a,ageHours:a.last===null?null:Math.max(0,(nowSec-(a.last+tf))/3600),
  warning:a.count===0?'No archive':a.gaps?'Archive contains missing intervals':null};
}
