
module.exports = {
	MjClass: MjClass
}


// ====================================================
//    MjClass class
// ====================================================

function MjClass(name) {
	this.name = name;
	
	var parentNames = ancestorTable[name];
	if (parentNames) {
		this.parents = parentNames.map(
			function(parentName){return getMjClass(parentName)}
		);
	}
	
	this.isa = function(cl) {
		var parentName = (cl instanceof MjClass) ? cl.name : cl;
		if (name == parentName)
			return true;
			
		if (this.parents) {
			for (var i=this.parents.length; i-->0; ) {
				if (this.parents[i].isa(cl))
					return true;
			}
		}
		
		return false;
	}
	
	this.uri = 'sief:' + name;
}

MjClass.prototype.toString = function() {
	return this.name;
}

MjClass.get = getMjClass;


var classCache = {};

function getMjClass(name) {
	if (!name)
		return undefined;
	if (name instanceof MjClass)
		return name;

	var cl = classCache[name];
	if (!cl) {
		cl = new MjClass(name);
		classCache[name] = cl;
		
		cl.valueOf = function() { return name; }
	}
	return cl;
}

var ancestorTable = {
	ActivityEvent : ['Activity','Event'],
	Application : ['Agent'],
	Ballot : ['Benchmark'],
	Challenge : ['Inquiry'],
	Community : ['Collaboration','ConceptScheme'],
	Discussion : ['Collaboration'],
	FormData : ['ValueSet'],
	FusionTask : ['Assignment'],
	Group : ['Agent'],
	IdeaScore : ['Facet'],
	Image : ['MediaResource'],
	Inquiry : ['Collaboration','ConceptScheme'],
	InquiryScore : ['Facet'],
	LikeBallot : ['Ballot'],
	Organization : ['Agent'],
	Person : ['Agent'],
	Questionnaire : ['Benchmark'],
	Review : ['Assessment'],
	ReviewForm : ['Questionnaire'],
	StarBallot : ['Ballot'],
	SuggestionBox : ['Inquiry'],
	UpDownBallot : ['Ballot'],
	User : ['Person'],
	UserScore : ['Facet'],
	Verb : ['Concept'],
	Vote : ['Assessment']
}

