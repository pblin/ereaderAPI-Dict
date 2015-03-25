package com.scholastic.ereader;
import java.util.*;
//import com.mongodb.Mongo;
import com.mongodb.DB;
import com.mongodb.DBCollection;
import com.mongodb.BasicDBObject;
//import com.mongodb.BasicDBList;
import com.mongodb.DBCursor;
import com.google.gson.*;

class PlayOrderClass {
	int order;
	String fragId;
	//String caption;
	
	PlayOrderClass (int i, String refId /*, String cap*/ )
	{
		order = i;
		fragId=refId;
		//caption=cap;
	}
	
}

public class ContentMetaData {
	private String ISBN; 
	// private String type;
	ContentMetaData (String id)
	{
		ISBN = id;
		// type = metaType;
		System.out.println(id);
	}
	
	//@SuppressWarnings("unchecked")
	String get(DB mdb) {
		Gson gson = new Gson();
		ArrayList<HashMap<String, String>> metaData = new ArrayList<HashMap<String,String>>();

		DBCollection coll = mdb.getCollection(ISBN);
		BasicDBObject query = new BasicDBObject();	
		// BasicDBObject field = new BasicDBObject();	
		
		String titlestr=null, authorstr = null, publisherstr=null, pubidstr=null, interaction;
		
		query.put("name", "metaHeader");
		//field.put("detail", 1);
		DBCursor cursor = coll.find(query);
		HashMap<String, String> metaHeader = new HashMap<String, String>();
		if (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();
			titlestr = obj.getString("title");
			authorstr = obj.getString("author");
			publisherstr = obj.getString("publisher");
			pubidstr = obj.getString("bookid");
			interaction = obj.getString("interaction"); 
			String bookCategoryStr = obj.getString("bookcategory");
			
			metaHeader.put("title", titlestr);
			metaHeader.put("author", authorstr);
			metaHeader.put("publisher", publisherstr);
			metaHeader.put("bookid", pubidstr);
			metaHeader.put("category", bookCategoryStr);
			metaHeader.put("interaction", interaction);
		}	

		query.put("name", "contentIndex");
		cursor = coll.find(query);
		// Integer i = 0;
		
		ArrayList<PlayOrderClass> playIndex = new ArrayList<PlayOrderClass>();
		Integer pageOne=0, lastPage=0;
		Integer p=0;
		while (cursor.hasNext()) {
			BasicDBObject obj = (BasicDBObject) cursor.next();
			String pageCaption=null;
			String fId = null;
			PlayOrderClass aPlayOrder = 
					new PlayOrderClass(	p=Integer.parseInt(obj.getString("playOrder")),
										fId=obj.getString("navId") /*,
										pageCaption=obj.getString("caption")*/ );
			
			/*
			if (pageCaption.toLowerCase().equals("page 1"))
			{
				pageOne = p;
				metaHeader.put ("pageone", p.toString());
				metaHeader.put ("pageonefragid", fId);
			}
			*/
			playIndex.add(aPlayOrder); 
		}	
		lastPage = p;
		metaHeader.put ("totalpage", p.toString());
		
		String playIndexJSONString = gson.toJson(playIndex);
		HashMap<String, String> playOrderHeader = new HashMap<String, String>();
		playOrderHeader.put("playOrders", playIndexJSONString);
		
		metaData.add(metaHeader);
		metaData.add(playOrderHeader);

		return gson.toJson(metaData); 
	}
}
