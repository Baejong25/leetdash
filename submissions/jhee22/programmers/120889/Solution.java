class Solution {
    public int solution(int[] sides) {
        int max = Integer.MIN_VALUE; 
        int total = 0; 
        
        // 전체합을 더한 다음 최대값을 빼는 걸로 생각
        for (int num : sides){
            total += num; 
            
            if (num > max) {
                max = num; 
            }
        }
        
        if (max < total - max) {
            return 1; 
        } 
        return 2; 
    }
}