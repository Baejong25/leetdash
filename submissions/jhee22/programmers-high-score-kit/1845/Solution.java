import java.util.*; 
class Solution {
    public int solution(int[] nums) {
        HashSet<Integer> set = new HashSet<>();
        
        // 내가 선택할 수 있는 포켓몬의 수 
        int cnt =  nums.length / 2; 
        
        // 서로 다른 포켓몬 종류의 수 
        for (int num : nums) {
            set.add(num); 
        } 
        int diff = set.size(); 
        
        return Math.min(cnt, diff);
    }
}