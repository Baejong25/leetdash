class Solution {
    public int solution(int a, int b) {
        int add = Integer.parseInt(String.valueOf(a) + String.valueOf(b)); 
        int dup = 2 * a * b; 
        if ( add >= dup ){
            return add; 
        }
        return dup; 
    }
}