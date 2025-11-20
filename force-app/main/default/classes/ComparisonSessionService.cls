public with sharing class ComparisonSessionService {
    public class SessionDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Datetime startedOn;
        @AuraEnabled public Datetime endedOn;
        @AuraEnabled public String propertiesJson;
        @AuraEnabled public String weightsJson;
        @AuraEnabled public String preferencesJson;
        @AuraEnabled public List<MemberDTO> members;
    }

    public class MemberDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Id userId;
        @AuraEnabled public String userName;
        @AuraEnabled public String email;
        @AuraEnabled public String role;
        @AuraEnabled public String inviteStatus;
        @AuraEnabled public String vote;
        @AuraEnabled public String notes;
    }

    @AuraEnabled
    public static Id createSession(String propertiesJson, String weightsJson, String preferencesJson, List<Id> participantIds) {
        Comparison_Session__c rec = new Comparison_Session__c();
        rec.User__c = UserInfo.getUserId();
        rec.Properties__c = propertiesJson;
        rec.Weights__c = weightsJson;
        rec.Preferences__c = preferencesJson;
        rec.Started_On__c = System.now();
        insert rec;

        List<Comparison_Session_Member__c> members = new List<Comparison_Session_Member__c>();
        // Add the owner automatically as Primary
        Comparison_Session_Member__c ownerMember = new Comparison_Session_Member__c();
        ownerMember.Comparison_Session__c = rec.Id;
        ownerMember.User__c = UserInfo.getUserId();
        ownerMember.Role__c = 'Primary';
        ownerMember.Invite_Status__c = 'Accepted';
        members.add(ownerMember);

        if (participantIds != null) {
            for (Id userId : participantIds) {
                if (userId == UserInfo.getUserId()) continue;
                Comparison_Session_Member__c member = new Comparison_Session_Member__c();
                member.Comparison_Session__c = rec.Id;
                member.User__c = userId;
                member.Role__c = 'CoBuyer';
                member.Invite_Status__c = 'Pending';
                member.Invite_Token__c = Crypto.generateDigest('SHA1', Blob.valueOf(rec.Id + String.valueOf(userId) + System.now()));
                members.add(member);
            }
        }

        if (!members.isEmpty()) {
            insert members;
        }
        return rec.Id;
    }

    @AuraEnabled
    public static void endSession(Id sessionId) {
        if (sessionId == null) return;
        Comparison_Session__c rec = [SELECT Id FROM Comparison_Session__c WHERE Id = :sessionId LIMIT 1];
        rec.Ended_On__c = System.now();
        update rec;
    }

    @AuraEnabled(cacheable=true)
    public static List<SessionDTO> getMySessions(Integer limitSize) {
        Integer lim = limitSize == null ? 50 : limitSize;
        List<Comparison_Session__c> rows = [
            SELECT Id, Started_On__c, Ended_On__c, Properties__c, Weights__c, Preferences__c,
                   (SELECT Id, User__c, User__r.Name, User__r.Email, Role__c, Invite_Status__c, Vote__c, Votes__c FROM Members__r)
            FROM Comparison_Session__c
            WHERE User__c = :UserInfo.getUserId()
            ORDER BY Started_On__c DESC
            LIMIT :lim
        ];
        List<SessionDTO> out = new List<SessionDTO>();
        for (Comparison_Session__c r : rows) {
            SessionDTO dto = new SessionDTO();
            dto.id = r.Id;
            dto.startedOn = r.Started_On__c;
            dto.endedOn = r.Ended_On__c;
            dto.propertiesJson = r.Properties__c;
            dto.weightsJson = r.Weights__c;
            dto.preferencesJson = r.Preferences__c;
            dto.members = new List<MemberDTO>();
            for (Comparison_Session_Member__c member : r.Members__r) {
                MemberDTO m = new MemberDTO();
                m.id = member.Id;
                m.userId = member.User__c;
                m.userName = member.User__r != null ? member.User__r.Name : null;
                m.email = member.User__r != null ? member.User__r.Email : null;
                m.role = member.Role__c;
                m.inviteStatus = member.Invite_Status__c;
                m.vote = member.Vote__c;
                m.notes = member.Votes__c;
                dto.members.add(m);
            }
            out.add(dto);
        }
        return out;
    }
}
