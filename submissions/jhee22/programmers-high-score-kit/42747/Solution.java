import java.util.*; 
class Solution {
    public int solution(int[] citations) {
        // 인용수 오름차순 정렬 
        Arrays.sort(citations); 
        
        // 인용배열 순회 
        int cnt = 0;
        for (int i = 0; i < citations.length; i++ ) {
            // 현재 인용 횟수 >= 남은 논문횟수 
            int curr_cite = citations[i]; 
            int rest = citations.length - i; 
            if (curr_cite >= rest){
                cnt++;
            }
        
        }
        
        return cnt; 
    }
}