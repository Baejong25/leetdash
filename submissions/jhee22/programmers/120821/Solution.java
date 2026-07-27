class Solution {
    public int[] solution(int[] num_list) {
        int left = 0; 
        int right = num_list.length - 1; 
        // 투 포인터 -> 두 포인터가 교차하기 직전까지 
        while (left < right) {
            int tmp = num_list[left]; 
            num_list[left] = num_list[right]; 
            num_list[right] = tmp; 
            
            left++; 
            right--; 
        }
        return num_list; 
    }
}