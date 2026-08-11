import java.util.HashMap;

class Solution {
    public String solution(String[] participant, String[] completion) {
//         String answer = "";
        
//         boolean [] b1 = new boolean [completion.length];
        
//         for(int i = 0; i < participant.length; i++) {
//             boolean b2 = false;
            
//             for(int j = 0; j < completion.length; j++) {
//                 if(!b1[j] && participant[i].equals(completion[j])) {
//                     b1[j] = true;
//                     b2 = true;
//                     break;
//                 }
//             }
            
//             if (!b2) {
//                 return participant[i];
//             }          
//         }
        
//         return answer;
        
        
        // O(N^2) 이라 중간에 터져버림
        //"어떤 값을 배열에서 빠르게 찾는다"라는 상황이면 HashMap, HashSet, 정렬 + 투 포인터 
        
        HashMap<String, Integer> map = new HashMap<>();
        
        for(String name : participant) {
            map.put(name , map.getOrDefault(name , 0) + 1);
        }
        
        for(String name : completion) {
            map.put(name , map.get(name) - 1);
        }
        
        for(String name : map.keySet()) {
            if(map.get(name) > 0) {
                return name;
            }
        }
        
        return "";        
        
    }
}