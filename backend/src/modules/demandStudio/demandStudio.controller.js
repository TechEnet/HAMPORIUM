
import mongoose from 'mongoose';
import Product from '../catalog/product.model.js';
import SKU from '../catalog/sku.model.js';
import SearchAnalytics from '../analytics/searchAnalytics.model.js';
import CommerceAnalytics from '../analytics/commerceAnalytics.model.js';
import { inventoryDashboard, resolveInventoryForProducts } from '../inventoryStudio/inventoryStudio.service.js';
import {Occasion,MarketingCampaign} from '../marketingStudio/marketingStudio.model.js';

const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.floor(Number(v)))):fallback;
export async function adminDemandOverview(req,res,next){try{
 const days=clamp(req.query.days,1,90,30),limit=clamp(req.query.limit,1,60,25);
 const since=new Date(Date.now()-days*86400000);
 const [productViews,searchClicks,topSearches,zeroResults]=await Promise.all([
  CommerceAnalytics.aggregate([{$match:{eventType:'product_view',createdAt:{$gte:since},product:{$ne:null}}},{$group:{_id:'$product',views:{$sum:1}}},{$sort:{views:-1}},{$limit:500}]),
  SearchAnalytics.aggregate([{$match:{eventType:'search_result_click',createdAt:{$gte:since},product:{$ne:null}}},{$group:{_id:'$product',clicks:{$sum:1}}},{$sort:{clicks:-1}},{$limit:500}]),
  SearchAnalytics.aggregate([{$match:{eventType:'search_submit',createdAt:{$gte:since}}},{$group:{_id:'$normalizedQuery',count:{$sum:1}}},{$sort:{count:-1}},{$limit:limit}]),
  SearchAnalytics.aggregate([{$match:{eventType:'search_submit',visibleResultCount:0,createdAt:{$gte:since}}},{$group:{_id:'$normalizedQuery',count:{$sum:1}}},{$sort:{count:-1}},{$limit:limit}]),
 ]);
 const scores=new Map();for(const x of productViews){scores.set(String(x._id),{productId:x._id,views:x.views,searchClicks:0})}
 for(const x of searchClicks){const id=String(x._id),v=scores.get(id)||{productId:x._id,views:0,searchClicks:0};v.searchClicks=x.clicks;scores.set(id,v)}
 const wanted=[...scores.values()].sort((a,b)=>b.views+b.searchClicks-a.views-a.searchClicks).slice(0,Math.max(200,limit));
 const products=await Product.find({_id:{$in:wanted.map(x=>x.productId)},status:'active'}).select('_id name slug status').lean();
 const stock=await resolveInventoryForProducts(products);const byStock=new Map(stock.map(x=>[String(x.productId),x]));
 const byProduct=new Map(products.map(p=>[String(p._id),p]));
 const ranked=wanted.filter(x=>byProduct.has(String(x.productId))).map(x=>({
  ...x,name:byProduct.get(String(x.productId)).name,slug:byProduct.get(String(x.productId)).slug,
  stockStatus:byStock.get(String(x.productId))?.status||'unverified',
  score:x.views+x.searchClicks*2,
 })).sort((a,b)=>b.score-a.score);
 const shortage=ranked.filter(x=>x.stockStatus==='out_of_stock');
 const [published,archived,skuCount,occasionCount,campaignCount,inventory]=await Promise.all([
  Product.countDocuments({status:'active'}),Product.countDocuments({status:'archived'}),SKU.countDocuments({}),Occasion.countDocuments({}),MarketingCampaign.countDocuments({}),inventoryDashboard({limit:20})
 ]);
 res.json({success:true,periodDays:days,overview:{liveProducts:published,archivedProducts:archived,totalSkus:skuCount,occasions:occasionCount,campaigns:campaignCount},inventory:inventory.counts,demand:{topSearches:topSearches.map(x=>({query:x._id,count:x.count})),zeroResultSearches:zeroResults.map(x=>({query:x._id,count:x.count})),mostInterestedProducts:ranked.slice(0,limit),outOfStockHighDemand:shortage.slice(0,limit),stockUnverifiedWithDemand:ranked.filter(x=>x.stockStatus==='unverified').slice(0,limit)},dataQuality:{stockSourceConfirmed:false,verifiedStockCount:inventory.stockRecordCount},note:'Aggregated analytics only. Unverified stock never counted as out of stock; no automatic product publication or purchase rules changed.'});
 }catch(e){next(e)}}
