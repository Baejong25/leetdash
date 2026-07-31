class Solution {
    static int answer;
    
    public int solution(int[] numbers, int target) {
        answer = 0;
        
    
        dfs(numbers, 0, 0, target);
        
        return answer;
    }
    
    public void dfs(int[] numbers, int cur, int idx, int target) {
        if (idx == numbers.length) {
            if (cur == target) {
                answer += 1;
            }
            return;
        }
        
        cur += numbers[idx];
        dfs(numbers, cur, idx + 1, target);
        cur -= numbers[idx] * 2;
        dfs(numbers, cur, idx + 1,  target);    
    }
}
