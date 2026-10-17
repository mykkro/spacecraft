/** Pure, bounded dependency planning. No inventory is changed until the full plan succeeds. */
const CraftPlanner = (() => {
  const copy=s=>({bag:{...s.bag},pool:{...s.pool},raw:{...s.raw},steps:s.steps.slice()});
  function plan(recipes,stock,stations,root,runs) {
    if(!root||!Number.isSafeInteger(runs)||runs<1||runs>9999)return null;
    function produce(recipe,batches,state,path) {
      if(!stations.has(recipe.station)||path.has(recipe.out)||state.steps.length>=64)return null;
      let next=copy(state),seen=new Set([...path,recipe.out]),cost={};
      for(const type of recipe.pattern)if(type)cost[type]=(cost[type]||0)+batches;
      for(const [type,amount] of Object.entries(cost)){
        next=take(type,amount,next,seen);if(!next)return null;
      }
      next.steps.push({recipe:recipes.indexOf(recipe),batches});
      next.pool[recipe.out]=(next.pool[recipe.out]||0)+recipe.qty*batches;
      return next;
    }
    function take(type,amount,state,path) {
      let next=copy(state);
      const ready=Math.min(amount,next.pool[type]||0);next.pool[type]=(next.pool[type]||0)-ready;amount-=ready;
      const owned=Math.min(amount,next.bag[type]||0);next.bag[type]=(next.bag[type]||0)-owned;
      next.raw[type]=(next.raw[type]||0)+owned;amount-=owned;
      if(!amount)return next;
      for(const recipe of recipes.filter(r=>r.out===type&&stations.has(r.station))){
        const batches=Math.ceil(amount/recipe.qty);
        if(batches>9999)continue;
        const result=produce(recipe,batches,next,path);
        if(result&&(result.pool[type]||0)>=amount){result.pool[type]-=amount;return result;}
      }
      return null;
    }
    const result=produce(root,runs,{bag:{...stock},pool:{},raw:{},steps:[]},new Set());
    if(!result)return null;
    result.pool[root.out]-=root.qty*runs;
    return {raw:Object.fromEntries(Object.entries(result.raw).filter(([,n])=>n>0)),
      extra:Object.fromEntries(Object.entries(result.pool).filter(([,n])=>n>0)),steps:result.steps};
  }
  return {plan};
})();
