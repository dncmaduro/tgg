const DAU = '̣̀́̃̉';
const NGUYEN = new Set('aeiouyăâêôơư');
const DAU_AM = ['qu','h','k','l','m','t','s','v'];
const CUM = ['oa','oe','uy'];
function boDau(s){ return [...s.normalize('NFD')].filter(c=>!DAU.includes(c)).join(''); }
function chuanAm(am){
  let tran = boDau(am);
  let d = [...am.normalize('NFD')];
  if (tran.length && tran[tran.length-1]==='y'
      && [...tran].filter(c=>NGUYEN.has(c)).length===1
      && tran.length>1 && DAU_AM.some(p=>tran.startsWith(p))) {
    d = [...d.join('').replace(/y/g,'i')];
    tran = boDau(d.join(''));
  }
  for (const cum of CUM){
    const i = tran.indexOf(cum);
    if (i < 0 || i + cum.length !== tran.length) continue;
    const vt = []; let k = 0;
    for (let j=0;j<d.length;j++){
      if (!DAU.includes(d[j])){ if (k===i||k===i+1) vt.push(j); k++; }
    }
    if (vt.length===2 && vt[0]+1<d.length && DAU.includes(d[vt[0]+1])){
      const e = d.slice(); const t = e.splice(vt[0]+1,1)[0]; e.splice(vt[1],0,t); d = e;
    }
    break;
  }
  return d.join('').normalize('NFC');
}
const chuan = tu => tu.split(' ').map(chuanAm).join(' ');
module.exports = { chuan, chuanAm };
