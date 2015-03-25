package com.scholastic.ereader;
import java.util.*;
//import com.mongodb.Mongo;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.BasicDBObject;
import com.mongodb.DBCursor;
import com.google.gson.*;

//Get thumbnail image of Content
public class ContentInfo {
	String ISBN;
	String sessionToken;
	String fragId;
	
	ContentInfo (String id, String token, String refId) {
		ISBN = id;
		sessionToken = token;
		fragId = refId;
	}
	
	String get (DB mdb) {
		HashMap<String, String> contentMap = new HashMap<String, String>();
		
		try {
			System.out.println ("ISBN= " + ISBN);
			DBCollection coll = mdb.getCollection(ISBN);
			if (coll == null)
			{
				Gson gson = new Gson();	
				return gson.toJson(contentMap);
			}
			
			BasicDBObject query = new BasicDBObject(), field = new BasicDBObject();	
			
			//String fragId, tbimg;
			
			query.put("fragId", fragId);		
		
			DBCursor cursor = coll.find(query);
			BasicDBObject obj;
			if (cursor.hasNext()){
				obj = (BasicDBObject) cursor.next();
			
				contentMap.put("fragId", obj.getString("fragId"));
				contentMap.put("thumbnail",obj.getString("tb"));
			}
		

		}
		catch (Exception e)
		{
			e.printStackTrace();
		}
		
		Gson gson = new Gson();	
		return gson.toJson(contentMap);
	}

}
