
module.exports = {
	getPoster: getPoster,
	getPutter: getPutter
}

function getPoster(posterType, requestedType) {
	var subPosters = posters[posterType];
	if (!subPosters)
		subPosters = posters.Entity;
	
	return subPosters[requestedType];
}

function getPutter(posterType) {
	return putters[posterType] || putters.Entity;
}


var posters = {
	Tenant: {
		Tenant:     postTenantToTenant,
		User:       postUserToTenant,
		Challenge:  postChallengeToTenant
	},
	Community: {
		User:       postUserToCommunity,
		Challenge:  postChallengeToCommunity
	},
	Challenge: {
		Idea:       postIdeaToChallenge
	},
	Discussion: {
		Comment:    postCommentToDiscussion,
	},
	Comment: {
		Comment:    postCommentToComment,
	},
	Entity: {
		Comment:    postCommentToEntity,
		Vote:       postVoteToEntity
	}
};
	
var putters = {
	Entity: putToEntity
};


function postTenantToTenant(target, args, done) {
	var esvc = target.entityService;
	if (!target.matches(esvc.systemTenant))
		return done('New tenants may only be posted to the system tenant');
	
	var newKey = args.key;
	if (!newKey)
		return done('Post of new tenant is missing "key" property');
	
	var creationArgs = copyObj({}, args);
	creationArgs.entityKey = newKey;
	delete creationArgs.key;
	
	esvc.systemSpace.create(creationArgs, function(err, newTenant){
		if (err) return done(err);
		
		// Create the dataSpace
		esvc.createDataSpace(newKey, newTenant, function(err, newDataSpace){
			if (err) return done(err);
			
			// Create the home community
			newDataSpace.create({
					type: 'Community', title: 'Home for '+args.title, inquiries: [], 
					
				}, function(err, home){
					newTenant.put({communities:[home]}, function(err){
						if (err) return done(err);
						
						// Create the home's participants group
						newDataSpace.create({
								type: 'Group', members:[], inSupportOf:home
								
							}, function(err, participants){
								home.put({participants: participants}, function(err){
									done(null, newTenant);
								});
						});
					});
			});
		});
	});
}

function postUserToTenant(tenant, args, done) {
	var home = tenant.communities[0];
	home.onLoad(function(err){
		if (err) return done(err);
		postUserToCommunity(home, args, done);
	});
}

function postChallengeToTenant(tenant, args, done) {
	var home = tenant.communities[0];
	home.onLoad(function(err){
		if (err) return done(err);
		postChallengeToCommunity(home, args, done);
	});
}

function postUserToCommunity(community, args, done) {
	var userProperties = copyObj({}, args);
	
	// Create the new user entity
	community.dataSpace.create(userProperties, function(err, user){
	
		// Add to the home's participants group
		var participants = community.participants;
		participants.onLoad(function(err){
			participants.members.push(user);
			participants.put({
				members: participants.members
			}, function(err) {
				if (err) return done(err);
				done(null, user);
			});
		});
	});
}

function postChallengeToCommunity(community, args, done) {
	var challengeProperties = copyObj({}, args);

	community.dataSpace.create({type:'IdeaSet', ideas:[]}, function(err, iset) {
		if (err) return done(err);
		
		challengeProperties.ideaSet = iset;
		community.dataSpace.create(challengeProperties, function(err, challenge){
		
			// Add to the home's inquiries list
			communities.inquiries.push(challenge);
			communities.put({ inquiries: communities.inquiries }, function(err){
				if (err) return done(err);
				done(null, challenge);
			});
		});
	});
}

function postIdeaToChallenge(challenge, args, done) {
	var scrubbedArgs = copyObj({}, args);
	scrubbedArgs.inquiry = challenge;
	var ideaSet = challenge.ideaSet;
	
	ideaSet.onLoad(function(err) {
		challenge.dataSpace.create(scrubbedArgs, function(err, idea){
			// then add the idea to the challenge's ideaSet
			ideaSet.ideas.push(idea);
			ideaSet.put({
				ideas: ideaSet.ideas
			}, function(err) {
				if (err) return done(err);
				done(null, idea);
			});
		});
	});
}

function postCommentToEntity(entity, args, done) {
	if (entity.discussion) {
		entity.discussion.onLoad(function(err){
			postCommentToDiscussion(entity.discussion, args, done);
		});
	}
	else {
		entity.dataSpace.create({
				type: 'Discussion',
				topic: entity,
				comments: []
			},
			function(err, discussion) {
				entity.update({discussion: discussion}, function(){});
				postCommentToDiscussion(discussion, args, done);
			}
		);
	}
}

function postCommentToDiscussion(discussion, args, done) {
	var scrubbedArgs = copyObj({}, args);
	scrubbedArgs.forum = discussion;
	
	discussion.onLoad(function(err){
		discussion.dataSpace.create(scrubbedArgs, function(err, comment) {
			if (err) return done(err);
			discussion.comments.push(comment);
			discussion.put({
				comments: discussion.comments
			}, function(err) {
				if (err) return done(err);
				done(null, comment);
			});
		});
	});
}

function postCommentToComment(comment, args, done) {
	var scrubbedArgs = copyObj({}, args);
	scrubbedArgs.replyTo = comment;
	
	postCommentToDiscussion(comment.forum, scrubbedArgs, function(err, newComment) {
		if (err) return done(err);
		var hasReplies = comment.hasReplies || [];
		hasReplies.push(newComment);
		comment.put({ hasReplies: hasReplies }, function(err){
			done(err, newComment);
		});
	});
}

function postVoteToEntity(entity, args, done) {
	var scrubbedArgs = copyObj({}, args);
	done('Not Yet Implemented: post vote');
}


function putToEntity(entity, args, done) {
	// TODO: reality checks here
	entity.update(args, done);
}


// ====================================================
//    utilities
// ====================================================

function copyObj(target, source) {
	for (var pname in source) {
		if (source.hasOwnProperty(pname))
			target[pname] = source[pname];
	}
	return target;
}

