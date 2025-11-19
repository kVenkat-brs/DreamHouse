public with sharing class ComparisonSessionService {
    public class SessionDTO {
        @AuraEnabled public Id id;
        @AuraEnabled public Datetime startedOn;
        @AuraEnabled public Datetime endedOn;
        @AuraEnabled public String propertiesJson;
        @AuraEnabled public String weightsJson;
        @AuraEnabled public String preferencesJson;
    }

    @AuraEnabled
    public static Id createSession(String propertiesJson, String weightsJson, String preferencesJson) {
        Comparison_Session__c rec = new Comparison_Session__c();
        rec.User__c = UserInfo.getUserId();
        rec.Properties__c = propertiesJson;
        rec.Weights__c = weightsJson;
        rec.Preferences__c = preferencesJson;
        rec.Started_On__c = System.now();
        insert rec;
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
            SELECT Id, Started_On__c, Ended_On__c, Properties__c, Weights__c, Preferences__c
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
            out.add(dto);
        }
        return out;
    }
}

