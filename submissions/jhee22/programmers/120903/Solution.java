import java.util.HashSet; 
class Solution {
    public int solution(String[] s1, String[] s2) {
        HashSet<String> set = new HashSet<>(); 
        
        for (String s : s1) {
            set.add(s); 
        }
        
        int answer = 0; 
        for (String ss : s2){
            if (set.contains(ss)){
                answer += 1 ;
            }
        }
        return answer; 
    }
}