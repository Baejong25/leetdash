import java.util.*; 
class Solution {
    public String solution(String[] participant, String[] completion) {
        HashMap<String, Integer> map = new HashMap<>(); 
        // 참가자 
        for (String p : participant) {
            map.put(p, map.getOrDefault(p, 0) + 1); 
        }
        
        // 완주자 
        for (String c : completion) {
            map.put(c, map.getOrDefault(c, 0) -1); 
        }
        
        // value = 1 인 key 값 꺼내기
        for (Map.Entry<String, Integer> entry : map.entrySet()){
            if (entry.getValue() == 1) {
                return entry.getKey(); 
            }
        }
        return "";
    }
}