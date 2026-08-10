import java.util.*;

class Solution {

    int count = 0;
    String[] user_id;
    String[] banned_id;
    boolean[] banned;
    Set<String> set = new HashSet<>();

    public int solution(String[] user_id, String[] banned_id) {
        this.user_id = user_id;
        this.banned_id = banned_id;
        banned = new boolean[user_id.length];


        check(0);

        int answer = count;
        return answer;
    }

    public void check(int idx){
        if(idx == banned_id.length){

            String ban = "";
            for(int i = 0; i < banned.length; i++){
                if(banned[i]){
                    ban += "1";
                }else{
                    ban += "0";
                }
            }
            if(set.contains(ban)){
                return;
            }
            set.add(ban);

            count++;
            return;
        }
        String bannedStr = banned_id[idx];
        for(int i = 0; i < user_id.length; i++){
            if(banned[i]){
                continue;
            }
            String userStr = user_id[i];
            if(bannedStr.length() != userStr.length()){
                continue;
            }

            boolean same = true;
            for(int j = 0; j < userStr.length(); j++){
                char b = bannedStr.charAt(j);
                char u = userStr.charAt(j);
                if(b == '*'){
                    continue;
                }
                if(b != u){
                    same = false;
                }
            }
            if(same){
                banned[i] = true;
                check(idx+1);
                banned[i] = false;
            }
        }
    }
}