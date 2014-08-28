
var Q = require('q');

module.exports = {
	getPoster: getPoster,
	getPutter: getPutter
}

function getPoster(posterType, args) {
	var action = args.action || 'post';
	if (action != 'post')
		throw ('Only post actions are supported here');

	var requestedType = args.type;
	if (!requestedType)
		throw ('Missing type property on post');

	var subPosters = posters[posterType.name];
	if (!subPosters)
		subPosters = posters.Entity;
	
	var poster = subPosters[requestedType];
	if (!poster)
		throw ('No fn defined for posting ' + requestedType + ' to ' + posterType.name);
		
	return poster;
}

function getPutter(posterType) {
	var putter = putters[posterType.name] || putters.Entity;
	if (!putter)
		throw ('No fn defined for putting to ' + posterType.name);

	return putter;
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


function errorPromise(msg) {
	return Q.fcall(function () { throw new Error(msg); });
}


function postTenantToTenant(target, args) {
	var esvc = target.entityService;
	if (!target.matches(esvc.systemTenant))
		return errorPromise('New tenants may only be posted to the system tenant');
	
	var newKey = args.key;
	if (!newKey)
		return errorPromise('Post of new tenant is missing "key" property');
	
	var creationArgs = copyObj({}, args);
	creationArgs.entityKey = newKey;
	delete creationArgs.key;
		
	var newTenant;
	var newDataSpace;
	var home;
	
	return esvc.systemSpace.create(creationArgs)
	.then(function(tenant){
		newTenant = tenant;
		// Create the dataSpace
		return esvc.createDataSpace(newKey, tenant);
	})
	.then(function(dspace){
		newDataSpace = dspace;
		// Create the home community
		return dspace.create({
			type: 'Community',
			title: 'Home for '+args.title,
			inquiries: []
			});
	})
	.then(function(community){
		home = community;
		return newTenant.put({communities:[community]});
	})
	.then(function(){
		// Create the home's participants group
		return newDataSpace.create({
			type: 'Group',
			members:[],
			inSupportOf:home
			});
	})
	.then(function(participants){
		return home.put({participants: participants});
	})
	.then(function(){
		return newTenant;
	});
}

function postUserToTenant(tenant, args) {
	return postUserToCommunity(tenant.communities[0], args);
}

function postChallengeToTenant(tenant, args) {
	return postChallengeToCommunity(tenant.communities[0], args);
}

function postUserToCommunity(community, args) {
	var userProperties = copyObj({}, args);
	var newUser;
	
	return community.load({ participants:1 })
	.then(function(){
		// Create the new user entity
		return community.create(userProperties);
	})
	.then(function(user){
		newUser = user;
		// Add the new user to the community's participants group
		return community.participants.add( { members : user } );
	})
	.then(function(){
		return newUser;
	});
}

function postChallengeToCommunity(community, args) {
	var challengeProperties = copyObj({}, args);
	// note: community.inquiries is a derived property
	
	// Create the ideaset for the new challenge
	return community.create({type:'IdeaSet', ideas:[]})
	.then(function(iset){
		// Create the new challenge
		challengeProperties.ideaSet = iset;
		return community.create(challengeProperties);
	})
	.then(function(challenge){
		return challenge;
	});
}

function postIdeaToChallenge(challenge, args) {
	var scrubbedArgs = copyObj({}, args);
	scrubbedArgs.inquiry = challenge;
	var newIdea;
	
	return challenge.load({ ideaSet:1 })
	.then(function(){
		return challenge.create(scrubbedArgs);
	})
	.then(function(idea){
		newIdea = idea;
		// Add the new idea to the inquiry's ideaSet
		return challenge.ideaSet.add( { ideas : idea } );
	})
	.then(function(){
		return newIdea;
	});
}

function postCommentToEntity(entity, args) {
	if (entity.isa('Discussion')) {
		return postCommentToDiscussion(entity, args);
	}
	if (entity.isa('Comment')) {
		return postCommentToComment(entity, args);
	}

	return entity.load({ discussion:1 })
	.then(function(){
		// Either return the discussion, or a promise for
		// creating a new discussion
		if (entity.discussion)
			return entity.discussion;
		else
			return entity.create({
				type: 'Discussion', topic: entity, comments: []
			});
	})
	.then(function(discussion){
		return postCommentToDiscussion(discussion, args);
	});
}

function postCommentToDiscussion(discussion, args) {
	var scrubbedArgs = copyObj({}, args);
	scrubbedArgs.forum = discussion;
	// note: discussion.comments is a derived property
	
	// Create the comment
	return discussion.create(scrubbedArgs);
}

function postCommentToComment(comment, args) {
	var scrubbedArgs = copyObj({}, args);
	scrubbedArgs.replyTo = comment;
	// note: discussion.comments and comment.hasReplies are derived properties

	return comment.load({ forum:1 })
	.then(function(){
		return postCommentToDiscussion(comment.forum, scrubbedArgs);
	});
}

function postVoteToEntity(entity, args) {
	var scrubbedArgs = copyObj({}, args);
	return errorPromise('Not Yet Implemented: post vote');
}


function putToEntity(entity, args) {
	// TODO: reality checks here
	return entity.update(args);
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

